<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared';
import type { ComplianceMapCollection, RemoteTerrain } from '@/services/api';
import { CERTAINTY_META } from '@/services/caykur/complianceMap';
import { containsTerrainPoint, polygonRings } from '@/services/caykur/terrainGeometry';

const props = defineProps<{ terrain: RemoteTerrain; parcels: ComplianceMapCollection; selectedKey: string | null }>();
const emit = defineEmits<{ select: [block: string, parcel: string] }>();
const container = ref<HTMLElement | null>(null);
const loading = ref(true);
const failed = ref(false);
const hovered = ref('');
let cancelled = false;
let dispose: (() => void) | null = null;
let repaint: (() => void) | null = null;
let reset: (() => void) | null = null;

onMounted(async () => {
    const el = container.value;
    if (!el) return;
    try {
        const t = props.terrain;
        if (!t.imageUrl.startsWith('/inventory-imagery/') || t.imageUrl.includes('..')) throw new Error('Local terrain required');
        const [THREE, { OrbitControls }, image] = await Promise.all([
            import('three'), import('three/examples/jsm/controls/OrbitControls.js'),
            new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = t.imageUrl;
            }),
        ]);
        if (cancelled) return;
        if (image.naturalWidth !== t.width || image.naturalHeight !== t.height) throw new Error('Terrain dimensions differ');
        const hc = document.createElement('canvas'); hc.width = t.width; hc.height = t.height;
        const hctx = hc.getContext('2d', { willReadFrequently: true });
        if (!hctx) throw new Error('Canvas unavailable');
        hctx.drawImage(image, 0, 0);
        const raw = hctx.getImageData(0, 0, t.width, t.height).data;
        const geometry = new THREE.PlaneGeometry(t.widthM, t.heightM, t.width - 1, t.height - 1);
        const position = geometry.attributes.position;
        for (let i = 0; i < position.count; i++) position.setZ(i, ((raw[i * 4] << 8 | raw[i * 4 + 1]) / 65535) * t.reliefM);
        geometry.rotateX(-Math.PI / 2); geometry.computeVertexNormals();
        const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = Math.round(2048 * t.heightM / t.widthM);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas unavailable');
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.MeshLambertMaterial({ map: texture });
        const mesh = new THREE.Mesh(geometry, material);
        const scene = new THREE.Scene(); scene.add(mesh, new THREE.AmbientLight(0xffffff, 2));
        const light = new THREE.DirectionalLight(0xffffff, 1.2); light.position.set(-1, 2, 1); scene.add(light);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        const camera = new THREE.PerspectiveCamera(45, 1, 1, 20000);
        const span = Math.max(t.widthM, t.heightM);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        el.appendChild(renderer.domElement);
        renderer.domElement.setAttribute('aria-label', 'Yaklaşık 3B arazi; klavye ile parsel seçmek için parsel listesini kullanın');
        renderer.domElement.setAttribute('role', 'img');
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.maxPolarAngle = Math.PI / 2 - 0.05; controls.minDistance = 40; controls.maxDistance = span * 3;
        const render = () => renderer.render(scene, camera);
        reset = () => { camera.position.set(0, t.reliefM / 2 + span * 0.55, span * 0.75); controls.target.set(0, t.reliefM / 2, 0); controls.update(); render(); };
        const [west, south] = t.bounds.southWest; const [east, north] = t.bounds.northEast;
        repaint = () => {
            const css = getComputedStyle(el);
            const token = (name: string) => css.getPropertyValue(name).trim();
            context.fillStyle = token('--muted'); context.fillRect(0, 0, canvas.width, canvas.height);
            for (const f of props.parcels.features) {
                const selected = f.properties.key === props.selectedKey;
                const color = CERTAINTY_META[f.properties.certainty].color.replace(/var\(([^)]+)\)/g, (_, name: string) => token(name));
                context.strokeStyle = selected ? token('--foreground') : color;
                context.fillStyle = color; context.lineWidth = selected ? 8 : 3;
                for (const rings of polygonRings(f.geometry)) {
                    context.beginPath();
                    for (const ring of rings) {
                        ring.forEach(([lon, lat], i) => {
                            const x = (lon - west) / (east - west) * canvas.width; const y = (north - lat) / (north - south) * canvas.height;
                            if (i) context.lineTo(x, y); else context.moveTo(x, y);
                        });
                        context.closePath();
                    }
                    context.globalAlpha = selected ? 0.45 : 0.18; context.fill('evenodd'); context.globalAlpha = 1; context.stroke();
                }
            }
            texture.needsUpdate = true; renderer.setClearColor(token('--background')); render();
        };
        const raycaster = new THREE.Raycaster();
        const parcelAt = (event: PointerEvent) => {
            const rect = renderer.domElement.getBoundingClientRect();
            raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera);
            const uv = raycaster.intersectObject(mesh)[0]?.uv;
            if (!uv) return null;
            return props.parcels.features.find((f) => containsTerrainPoint(f.geometry, west + uv.x * (east - west), south + uv.y * (north - south)))?.properties ?? null;
        };
        let down: { id: number; x: number; y: number } | null = null;
        const pointers = new Set<number>();
        let frame = 0;
        const onDown = (event: PointerEvent) => { pointers.add(event.pointerId); down = pointers.size === 1 && event.button === 0 ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null; };
        const onUp = (event: PointerEvent) => {
            pointers.delete(event.pointerId); const start = down; down = null;
            if (!start || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
            const p = parcelAt(event); if (p) emit('select', p.block, p.parcel);
        };
        const onCancel = (event: PointerEvent) => { pointers.delete(event.pointerId); down = null; hovered.value = ''; };
        const onMove = (event: PointerEvent) => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { const p = parcelAt(event); hovered.value = p ? `${p.block}/${p.parcel} · ${CERTAINTY_META[p.certainty].label}` : ''; }); };
        renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointerup', onUp); renderer.domElement.addEventListener('pointermove', onMove); renderer.domElement.addEventListener('pointercancel', onCancel);
        controls.addEventListener('change', render);
        const resize = () => { if (!el.clientWidth || !el.clientHeight) return; camera.aspect = el.clientWidth / el.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(el.clientWidth, el.clientHeight); render(); };
        const observer = new ResizeObserver(resize); observer.observe(el);
        const theme = new MutationObserver(() => repaint?.()); theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
        dispose = () => { observer.disconnect(); theme.disconnect(); cancelAnimationFrame(frame); controls.dispose(); geometry.dispose(); material.dispose(); texture.dispose(); renderer.dispose(); renderer.domElement.remove(); };
        resize(); reset(); repaint(); loading.value = false;
    } catch { if (!cancelled) { failed.value = true; loading.value = false; } dispose?.(); }
});
watch(() => [props.parcels, props.selectedKey], () => repaint?.());
onBeforeUnmount(() => { cancelled = true; dispose?.(); repaint = null; reset = null; });
</script>

<template>
    <div class="space-y-2">
        <Button variant="outline" class="min-h-11" :disabled="loading || failed" @click="reset?.()">Görünümü sıfırla</Button>
        <div class="relative isolate h-[26rem] overflow-hidden rounded-lg border sm:h-[34rem]">
            <div ref="container" class="size-full touch-none" />
            <LoadingState v-if="loading" class="absolute inset-0 bg-background" text="Yerel 3B yüzey yükleniyor…" />
            <p v-if="failed" role="alert" class="absolute inset-0 flex items-center justify-center bg-background p-4 text-sm">3B yüzey açılamadı. WebGL veya yerel yükseklik dosyası kullanılamıyor; aşağıdaki parsel listesinden kanıtları açabilirsiniz.</p>
            <p v-if="hovered" class="pointer-events-none absolute left-2 top-2 rounded border bg-background p-2 text-xs">{{ hovered }}</p>
        </div>
        <p class="text-xs text-muted-foreground">Sürükleyerek döndürün, iki parmakla veya tekerlekle yaklaşın. Tıklayınca parsel kanıtları açılır. Klavye için aşağıdaki parsel seçimini kullanın. Yüzey görelidir; bina/ağaç modeli veya hassas alan ölçümü değildir.</p>
    </div>
</template>
