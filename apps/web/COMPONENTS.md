# Components Documentation

Bu belge, @cayhesabim/web uygulamasındaki UI komponentleri, composables ve stores hakkında kapsamlı bir referans sağlar.

---

## UI Komponentleri

Tüm komponentler `@/components` veya `@/components/ui` path'inden import edilebilir.

```ts
import { AppButton, AppInput, AppModal } from '@/components'
```

---

### AppButton

Farklı varyant ve boyutları destekleyen buton komponenti.

**Props:**
| Prop | Tip | Varsayılan | Açıklama |
|------|-----|------------|----------|
| `variant` | `'primary' \| 'secondary' \| 'danger' \| 'link' \| 'ghost'` | `'primary'` | Buton stili |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Buton boyutu |
| `loading` | `boolean` | `false` | Yükleme spinner'ı göster |
| `disabled` | `boolean` | `false` | Butonu devre dışı bırak |
| `block` | `boolean` | `false` | Tam genişlik |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | HTML button type |

**Slots:**
- `default` - Buton içeriği
- `icon` - İkon slotu (loading=false iken gösterilir)

**Örnek:**
```vue
<AppButton variant="primary" :loading="isSubmitting">
  Kaydet
</AppButton>

<AppButton variant="danger" size="sm">
  Sil
</AppButton>
```

---

### AppInput

Label, error ve helper text desteği olan input komponenti.

**Props:**
| Prop | Tip | Varsayılan | Açıklama |
|------|-----|------------|----------|
| `modelValue` | `string \| number` | `''` | v-model değeri |
| `label` | `string` | - | Input etiketi |
| `type` | `string` | `'text'` | Input tipi |
| `placeholder` | `string` | - | Placeholder metni |
| `error` | `string` | - | Hata mesajı |
| `helperText` | `string` | - | Yardım metni |
| `disabled` | `boolean` | `false` | Devre dışı |
| `required` | `boolean` | `false` | Zorunlu alan |
| `maxlength` | `number` | - | Maksimum karakter |
| `min`, `max`, `step` | `number \| string` | - | Sayı input özellikleri |

**Slots:**
- `prefix` - Input öneki (ikon vb.)
- `suffix` - Input soneki

**Örnek:**
```vue
<AppInput
  v-model="email"
  label="E-posta"
  type="email"
  :error="errors.email"
  required
/>
```

---

### AppPasswordInput

Şifre görünürlük toggle ve güçlülük göstergesi olan şifre input'u.

**Props:**
| Prop | Tip | Varsayılan | Açıklama |
|------|-----|------------|----------|
| `modelValue` | `string` | `''` | v-model değeri |
| `label` | `string` | - | Input etiketi |
| `placeholder` | `string` | - | Placeholder |
| `error` | `string` | - | Hata mesajı |
| `helperText` | `string` | - | Yardım metni |
| `showStrength` | `boolean` | `false` | Şifre güçlülük göstergesi |
| `disabled` | `boolean` | `false` | Devre dışı |
| `required` | `boolean` | `false` | Zorunlu |

**Örnek:**
```vue
<AppPasswordInput
  v-model="password"
  label="Parola"
  showStrength
  required
/>
```

---

### AppSelect

Arama ve çoklu seçim desteği olan dropdown select komponenti.

**Props:**
| Prop | Tip | Varsayılan | Açıklama |
|------|-----|------------|----------|
| `modelValue` | `string \| number \| null \| (string\|number)[]` | `null` | Seçili değer(ler) |
| `options` | `SelectOption[]` | - | Seçenek listesi |
| `label` | `string` | - | Select etiketi |
| `placeholder` | `string` | `'Seçiniz...'` | Placeholder |
| `error` | `string` | - | Hata mesajı |
| `helperText` | `string` | - | Yardım metni |
| `disabled` | `boolean` | `false` | Devre dışı |
| `required` | `boolean` | `false` | Zorunlu |
| `searchable` | `boolean` | `false` | Arama aktif |
| `multiple` | `boolean` | `false` | Çoklu seçim |

**SelectOption Interface:**
```ts
interface SelectOption {
  value: string | number
  label: string
  group?: string
}
```

**Örnek:**
```vue
<AppSelect
  v-model="selectedCity"
  :options="cities"
  label="Şehir"
  searchable
/>
```

---

### AppTextarea

Karakter sayacı desteği olan textarea komponenti.

**Props:**
| Prop | Tip | Varsayılan | Açıklama |
|------|-----|------------|----------|
| `modelValue` | `string` | `''` | v-model değeri |
| `label` | `string` | - | Textarea etiketi |
| `placeholder` | `string` | - | Placeholder |
| `error` | `string` | - | Hata mesajı |
| `helperText` | `string` | - | Yardım metni |
| `rows` | `number` | `4` | Satır sayısı |
| `maxlength` | `number` | - | Maksimum karakter |
| `showCount` | `boolean` | `false` | Karakter sayacı |
| `disabled` | `boolean` | `false` | Devre dışı |
| `required` | `boolean` | `false` | Zorunlu |

---

### AppCheckbox

v-model desteği olan checkbox komponenti.

**Props:**
| Prop | Tip | Varsayılan | Açıklama |
|------|-----|------------|----------|
| `modelValue` | `boolean` | `false` | Seçili durumu |
| `label` | `string` | - | Checkbox etiketi |
| `disabled` | `boolean` | `false` | Devre dışı |

**Örnek:**
```vue
<AppCheckbox v-model="acceptTerms" label="Kullanım şartlarını kabul ediyorum" />
```

---

### AppRadio

Radio button group için radio komponenti.

**Props:**
| Prop | Tip | Varsayılan | Açıklama |
|------|-----|------------|----------|
| `modelValue` | `string \| number \| null` | `null` | Seçili değer |
| `value` | `string \| number` | - | Bu radio'nun değeri |
| `label` | `string` | - | Radio etiketi |
| `name` | `string` | - | Radio group adı |
| `disabled` | `boolean` | `false` | Devre dışı |

**Örnek:**
```vue
<AppRadio v-model="gender" value="male" name="gender" label="Erkek" />
<AppRadio v-model="gender" value="female" name="gender" label="Kadın" />
```

---

### AppModal

Teleport ile body'ye render edilen modal dialog komponenti.

**Props:**
| Prop | Tip | Varsayılan | Açıklama |
|------|-----|------------|----------|
| `modelValue` | `boolean` | - | Modal açık/kapalı durumu |
| `title` | `string` | - | Modal başlığı |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Modal boyutu |
| `closable` | `boolean` | `true` | Kapatma butonu göster |
| `persistent` | `boolean` | `false` | Overlay tıklamasında kapatma |

**Slots:**
- `default` - Modal içeriği
- `footer` - Modal footer (butonlar vb.)

**Events:**
- `update:modelValue` - v-model güncellemesi
- `close` - Modal kapandığında

**Örnek:**
```vue
<AppModal v-model="showModal" title="Onayla" size="sm">
  <p>Bu işlemi onaylıyor musunuz?</p>
  
  <template #footer>
    <AppButton variant="secondary" @click="showModal = false">İptal</AppButton>
    <AppButton variant="primary" @click="confirm">Onayla</AppButton>
  </template>
</AppModal>
```

---

### AppToast

Global toast notification komponenti. **App.vue'da bir kez eklenmeli.**

**Kullanım:**
```vue
<!-- App.vue'da -->
<template>
  <RouterView />
  <AppToast />
</template>
```

Toast göstermek için `useToast` composable kullanılır.

---

## Composables

### useToast

Toast notification'ları yönetmek için composable.

**API:**
```ts
const toast = useToast()

// Toast göster
toast.success('Başarıyla kaydedildi!')
toast.error('Bir hata oluştu')
toast.warning('Dikkat!')
toast.info('Bilgi mesajı')

// Özel süre (ms)
toast.success('Mesaj', 6000)

// Toast kaldır
toast.remove(toastId)
```

---

### useAuth

Authentication işlemleri için composable.

**API:**
```ts
const { 
  isLoading,      // ref<boolean>
  error,          // ref<string | null>
  isAuthenticated,// computed<boolean>
  user,           // computed<User | null>
  login,          // (credentials) => Promise<boolean>
  logout,         // () => Promise<void>
  register,       // (data) => Promise<{success, message?}>
  forgotPassword, // (email) => Promise<{success, message?}>
  clearError      // () => void
} = useAuth()
```

**Örnek:**
```ts
const { login, isLoading, error } = useAuth()

async function handleSubmit() {
  const success = await login({ email, password })
  if (success) {
    // Otomatik olarak /dashboard'a yönlendirilir
  }
}
```

---

### useConfirm

Promise-based onay dialog'u için composable.

**API:**
```ts
const { confirm } = useConfirm()

// Basit kullanım
const result = await confirm('Bu öğeyi silmek istiyor musunuz?')

// Detaylı kullanım
const result = await confirm({
  title: 'Silme Onayı',
  message: 'Bu işlem geri alınamaz!',
  confirmText: 'Evet, Sil',
  cancelText: 'Vazgeç',
  variant: 'danger'
})

if (result) {
  // Onaylandı
}
```

---

## Stores (Pinia)

| Store | Açıklama |
|-------|----------|
| `authStore` | Kullanıcı authentication durumu ve token yönetimi |
| `fieldsStore` | Tarla verileri yönetimi |
| `harvestsStore` | Hasat verileri yönetimi |
| `paymentsStore` | Ödeme verileri yönetimi |
| `forumStore` | Forum state yönetimi |
| `geoStore` | Coğrafi konum verileri (il, ilçe, mahalle) |

**Örnek Store Kullanımı:**
```ts
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()
console.log(authStore.user)
console.log(authStore.isAuthenticated)
```
