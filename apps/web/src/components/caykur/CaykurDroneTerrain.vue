<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { LoadingState } from '@/components/shared';
import type { DroneMapClass, DroneMapCollection, DroneOrthophoto } from '@/services/api';

/**
 * 3D terrain view of a drone source: the approximate orthophoto draped over the ground surface solved from the video,
 * with the cadastral outlines painted into the texture in their class colour. Heights are relative and carry no
 * buildings or trees; nothing is measured here. Clicking the ground opens the parcel under the pointer.
 */
const props = defineProps<{ orthophoto: DroneOrthophoto; imageryBaseUrl: string; parcels: DroneMapCollection; colors: Record<DroneMapClass, string> }>();
const emit = defineEmits<{ open: [block: string, parcel: string] }>();

type Ring = Array<[number, number]>;
const container = ref<HTMLElement | null>(null);
const isLoading = ref(true);
const failed = ref(false);
const hovered = ref('');
let dispose: (() => void) | null = null;

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`image not loaded: ${url}`));
        img.src = url;
    });
}
function ringsOf(g: GeoJSON.Polygon | GeoJSON.MultiPolygon): Ring[] {
    const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    return polygons.map((p) => p[0] as Ring);
}
function inside(ring: Ring, x: number, y: number): boolean {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i] as [number, number];
        const [xj, yj] = ring[j] as [number, number];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
}

onMounted(async () => {
    const el = container.value;
    const terrain = props.orthophoto.terrain;
    if (!el || !terrain) return;
    try {
        const [THREE, { OrbitControls }, photo, heights] = await Promise.all([
            import('three'),
            import('three/examples/jsm/controls/OrbitControls.js'),
            loadImage(props.imageryBaseUrl + props.orthophoto.image),
            loadImage(props.imageryBaseUrl + terrain.image),
        ]);
        const [west, south] = props.orthophoto.bounds.southWest;
        const [east, north] = props.orthophoto.bounds.northEast;
        const widthM = props.orthophoto.width * props.orthophoto.resolutionM;
        const heightM = props.orthophoto.height * props.orthophoto.resolutionM;

        // Texture: the orthophoto on a neutral ground, with the outlines painted in.
        const canvas = document.createElement('canvas');
        canvas.width = photo.naturalWidth;
        canvas.height = photo.naturalHeight;
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        ctx.fillStyle = '#d6d9d2';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(photo, 0, 0);
        const px = (lon: number) => ((lon - west) / (east - west)) * canvas.width;
        const py = (lat: number) => ((north - lat) / (north - south)) * canvas.height;
        ctx.lineJoin = 'round';
        for (const pass of ['rest', 'analysed'] as const) {
            for (const f of props.parcels.features) {
                const done = f.properties.class !== 'not_analysed';
                if (done !== (pass === 'analysed')) continue;
                ctx.strokeStyle = done ? props.colors[f.properties.class] : 'rgba(255,255,255,0.75)';
                ctx.lineWidth = done ? 3 : 1.5;
                for (const ring of ringsOf(f.geometry)) {
                    ctx.beginPath();
                    ring.forEach(([lon, lat], i) => (i ? ctx.lineTo(px(lon), py(lat)) : ctx.moveTo(px(lon), py(lat))));
                    ctx.closePath();
                    ctx.stroke();
                }
            }
        }

        // Ground: one vertex per terrain cell, height from the two 8 bit channels.
        const hc = document.createElement('canvas');
        hc.width = terrain.width;
        hc.height = terrain.height;
        const hctx = hc.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
        hctx.drawImage(heights, 0, 0);
        const raw = hctx.getImageData(0, 0, terrain.width, terrain.height).data;
        const geometry = new THREE.PlaneGeometry(widthM, heightM, terrain.width - 1, terrain.height - 1);
        const pos = geometry.attributes.position as InstanceType<typeof THREE.BufferAttribute>;
        for (let i = 0; i < pos.count; i++) pos.setZ(i, ((((raw[i * 4] as number) << 8) | (raw[i * 4 + 1] as number)) / 65535) * terrain.reliefM);
        geometry.rotateX(-Math.PI / 2);
        geometry.computeVertexNormals();
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        const material = new THREE.MeshLambertMaterial({ map: texture });
        const mesh = new THREE.Mesh(geometry, material);

        const scene = new THREE.Scene();
        scene.add(mesh, new THREE.AmbientLight(0xffffff, 2.2));
        const sun = new THREE.DirectionalLight(0xffffff, 1.2);
        sun.position.set(-1, 2, 1);
        scene.add(sun);
        const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 5, 20000);
        const span = Math.max(widthM, heightM);
        camera.position.set(0, terrain.reliefM / 2 + span * 0.55, span * 0.75);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(el.clientWidth, el.clientHeight);
        renderer.setClearColor(0xeef0ec);
        renderer.domElement.setAttribute('role', 'img');
        renderer.domElement.setAttribute('aria-label', 'Drone ortofotosu giydirilmiş 3B arazi modeli; parsel sınırları sınıf rengiyle çizili');
        el.appendChild(renderer.domElement);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, terrain.reliefM / 2, 0);
        controls.maxPolarAngle = Math.PI / 2 - 0.05;
        controls.minDistance = 40;
        controls.maxDistance = span * 2;
        controls.update();
        const render = () => renderer.render(scene, camera);
        controls.addEventListener('change', render);
        render();

        // Pointer → ground → parcel.
        const raycaster = new THREE.Raycaster();
        const parcelAt = (event: PointerEvent) => {
            const box = renderer.domElement.getBoundingClientRect();
            const point = new THREE.Vector2(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1);
            raycaster.setFromCamera(point, camera);
            const uv = raycaster.intersectObject(mesh)[0]?.uv;
            if (!uv) return null;
            const lon = west + uv.x * (east - west);
            const lat = south + uv.y * (north - south);
            return props.parcels.features.find((f) => ringsOf(f.geometry).some((r) => inside(r, lon, lat)))?.properties ?? null;
        };
        let down: [number, number] | null = null;
        let frame = 0;
        const onDown = (e: PointerEvent) => (down = [e.clientX, e.clientY]);
        const onUp = (e: PointerEvent) => {
            // A drag turns the model; only a still click opens a parcel.
            if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
            const p = parcelAt(e);
            if (p) emit('open', p.block, p.parcel);
        };
        const onMove = (e: PointerEvent) => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const p = parcelAt(e);
                hovered.value = p ? `${p.block}/${p.parcel} · ${p.nature}` : '';
            });
        };
        renderer.domElement.addEventListener('pointerdown', onDown);
        renderer.domElement.addEventListener('pointerup', onUp);
        renderer.domElement.addEventListener('pointermove', onMove);
        const observer = new ResizeObserver(() => {
            camera.aspect = el.clientWidth / el.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(el.clientWidth, el.clientHeight);
            render();
        });
        observer.observe(el);
        dispose = () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
            controls.dispose();
            geometry.dispose();
            material.dispose();
            texture.dispose();
            renderer.dispose();
            renderer.domElement.remove();
        };
        isLoading.value = false;
    } catch {
        failed.value = true;
        isLoading.value = false;
    }
});
onBeforeUnmount(() => dispose?.());
</script>

<template>
    <div class="flex flex-col gap-2">
        <div class="relative isolate h-[32rem] w-full overflow-hidden rounded-lg border">
            <div ref="container" class="size-full touch-none" />
            <LoadingState v-if="isLoading" text="3B model hazırlanıyor…" class="absolute inset-0 bg-background" />
            <p v-if="failed" class="absolute inset-0 flex items-center justify-center bg-background p-6 text-center text-sm text-muted-foreground">3B görünüm açılamadı: tarayıcı WebGL desteklemiyor ya da görüntüler yüklenemedi. Parsel haritası ve liste aynı bilgiyi verir.</p>
            <p v-if="hovered" class="pointer-events-none absolute left-2 top-2 rounded-md border bg-background px-2 py-1 text-xs">{{ hovered }}</p>
        </div>
        <p class="text-xs text-muted-foreground">Sürükleyerek döndürün, tekerlek ya da iki parmakla yaklaşın, sağ tuşla kaydırın. Bir parsele tıklayınca ayrıntısı açılır. Klavye ile parsel açmak için aşağıdaki listeyi kullanın.</p>
    </div>
</template>
