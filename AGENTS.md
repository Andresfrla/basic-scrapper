# CLAUDE.md — SAT CEP Scraper App

## Descripción General

Aplicación Vite + React que consume el portal del SAT:
`https://aplicacionesc.mat.sat.gob.mx/SOIA_CR_WEB/oia_consultarap_cep.aspx`

Permite consultar el estado de pedimentos por tres métodos (Pedimento, VIN, Contenedor),
acumular los resultados en una tabla persistente durante la sesión, y navegar al detalle
completo de cada registro.

---

## Stack Técnico

| Capa           | Tecnología                                            |
| -------------- | ----------------------------------------------------- |
| Bundler        | Vite 5                                                |
| Framework      | React 18                                              |
| Routing        | React Router v6                                       |
| Estado global  | Zustand                                               |
| HTTP / Proxy   | Axios + servidor Express proxy local                  |
| Parseo HTML    | cheerio (en el proxy)                                 |
| Estilos        | Tailwind CSS v3                                       |
| Componentes UI | shadcn/ui (Table, Badge, Button, Select, Input, Card) |
| Iconos         | lucide-react                                          |

---

## Arquitectura del Proyecto

```
sat-cep-scraper/
├── CLAUDE.md                        ← este archivo
├── package.json
├── vite.config.ts                   ← proxy /api → Express local
├── tailwind.config.ts
├── tsconfig.json
│
├── proxy-server/                    ← servidor Express (Node)
│   ├── index.js                     ← punto de entrada, puerto 3001
│   ├── routes/
│   │   └── cep.js                   ← rutas POST /api/cep/consultar
│   └── scraper/
│       ├── client.js                ← manejo de cookies/session SAT
│       ├── pedimento.js             ← scraper por pedimento
│       ├── vin.js                   ← scraper por VIN
│       ├── contenedor.js            ← scraper por contenedor
│       └── parser.js               ← parseo HTML con cheerio → objetos tipados
│
├── src/
│   ├── main.tsx
│   ├── App.tsx                      ← Router con rutas / y /detalle/:id
│   │
│   ├── store/
│   │   └── useResultsStore.ts       ← Zustand: lista acumulada de resultados
│   │
│   ├── constants/
│   │   └── satOptions.ts            ← aduanas y años hardcodeados (extraídos del HTML del SAT)
│   │
│   ├── types/
│   │   └── cep.ts                   ← interfaces TypeScript (ver sección Tipos)
│   │
│   ├── api/
│   │   └── cepApi.ts                ← función consultar(params) → CepResultado[]
│   │
│   ├── pages/
│   │   ├── ConsultaPage.tsx         ← página principal (form + tabla)
│   │   └── DetallePage.tsx          ← página de detalle individual
│   │
│   └── components/
│       ├── ConsultaForm.tsx         ← formulario de búsqueda
│       ├── ResultadosTabla.tsx      ← tabla acumulada de resultados
│       ├── DetallePedimento.tsx     ← sección info del pedimento
│       └── DetalleEstadoPago.tsx    ← sección info del estado de pago
│
└── public/
```

---

## Tipos TypeScript (`src/types/cep.ts`)

```typescript
// Métodos de consulta disponibles
export type MetodoConsulta = "pedimento" | "vin" | "contenedor";

// Parámetros del formulario de consulta
export interface ConsultaParams {
  metodo: MetodoConsulta;
  valor: string; // número de pedimento, VIN, o contenedor
  aduana?: string; // requerida para pedimento y contenedor
  anio?: string; // requerida para pedimento, VIN y contenedor
  patente?: string; // requerida solo para pedimento
}

// Fila en la tabla de resultados (vista resumida)
export interface CepResultadoResumen {
  id: string; // generado localmente: uuid o hash
  documento: string; // Columna "Documento" del portal (Identificador en tabla)
  estado: string; // estado del pedimento
  fecha: string; // fecha del pedimento
  metodoConsulta: MetodoConsulta;
  // referencia completa para la página de detalle
  detalle: CepDetalle;
}

// Detalle completo del pedimento
export interface CepDetalle {
  documento: string;
  aduana: string;
  anio: string;
  patente: string;
  numeroPedimento: string;
  situacionPedimento: string;
  estado: string;
  fecha: string;
  numeroOperacion: string;
  estadoPago: CepEstadoPago;
}

// Información de pago
export interface CepEstadoPago {
  banco: string;
  monto: string;
  numeroOperacion: string;
  fechaPago: string;
  lineaCaptura: string;
  estado: string;
  lineaCapturaSecundaria?: string; // segunda línea de captura si existe
}
```

---

## Proxy Server (`proxy-server/`)

### Por qué es necesario

El portal del SAT no permite peticiones cross-origin desde el navegador. El servidor
Express actúa como intermediario: recibe la solicitud del frontend, realiza la petición
al portal SAT con las cookies de sesión correctas, parsea el HTML y devuelve JSON.

### `proxy-server/index.js`

```js
import express from "express";
import cors from "cors";
import cepRoutes from "./routes/cep.js";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
app.use("/api/cep", cepRoutes);
app.listen(3001, () => console.log("Proxy SAT corriendo en :3001"));
```

### `proxy-server/routes/cep.js`

```js
// POST /api/cep/consultar
// Body: ConsultaParams
// Response: CepResultadoResumen[]
```

### `proxy-server/scraper/client.js`

- Maneja la sesión HTTP con el portal SAT (cookies `ASP.NET_SessionId`, viewstate, etc.)
- Función `getSessionTokens()` → hace GET inicial y extrae `__VIEWSTATE`, `__EVENTVALIDATION`
- Función `postConsulta(params, tokens)` → hace POST con el formulario del portal

### `proxy-server/scraper/parser.js`

- Recibe HTML de respuesta del SAT
- Usa cheerio para seleccionar la tabla de resultados
- Mapea cada fila `<tr>` a un objeto `CepDetalle`
- Extrae el bloque de "Información del estado de pago" de la misma página o del detalle secundario

---

## Store Zustand (`src/store/useResultsStore.ts`)

```typescript
interface ResultsStore {
  resultados: CepResultadoResumen[];
  agregarResultados: (nuevos: CepResultadoResumen[]) => void;
  limpiarResultados: () => void;
}
```

Los resultados se acumulan: cada consulta exitosa **agrega** filas a la tabla sin reemplazar
las anteriores. El usuario puede limpiar manualmente con el botón "Limpiar tabla".

---

## API Client (`src/api/cepApi.ts`)

```typescript
// Llama al proxy local, no al SAT directamente
export async function consultar(
  params: ConsultaParams,
): Promise<CepResultadoResumen[]>;
```

- Base URL: `http://localhost:3001/api/cep/consultar`
- Manejo de errores: lanza `Error` con mensaje legible si el proxy falla

---

## Páginas

### `ConsultaPage.tsx`

Layout: dos columnas en desktop, una en móvil.

- Columna izquierda (1/3): `<ConsultaForm />`
- Columna derecha (2/3): `<ResultadosTabla />`

Estado local de la página:

- `loading: boolean` — mientras se procesa la consulta
- `error: string | null` — mensaje de error visible

### `DetallePage.tsx`

- Lee el `id` de los params de React Router
- Busca el resultado en el store de Zustand
- Renderiza `<DetallePedimento />` y `<DetalleEstadoPago />`
- Botón "← Volver" navega a `/`

---

## Componentes

### `ConsultaForm.tsx`

Campos:

| Campo           | Tipo                                           | Cuándo aparece              |
| --------------- | ---------------------------------------------- | --------------------------- |
| Método          | `<Select>` (pedimento/vin/contenedor)          | Siempre                     |
| Aduana          | `<Select>` — opciones de `SAT_OPTIONS.aduanas` | Pedimento y Contenedor      |
| Año             | `<Select>` — opciones de `SAT_OPTIONS.anios`   | Pedimento, VIN y Contenedor |
| Patente         | `<Input>` numérico                             | Solo pedimento              |
| Valor           | `<Input>` placeholder dinámico según método    | Siempre                     |
| Botón Consultar | `<Button>` con spinner                         | Siempre                     |

Al enviar llama a `consultar(params)` y despacha `agregarResultados()` al store.

Los `value` de Aduana y Año coinciden **exactamente** con los del portal SAT
(`cmbAduanas` y `cmbAnios`), por lo que se mandan directo en el POST sin transformación.

#### Visibilidad de campos por método

| Campo                  | Pedimento           | VIN    | Contenedor           |
| ---------------------- | ------------------- | ------ | -------------------- |
| Aduana (`cmbAduanas`)  | ✅                  | ❌     | ✅                   |
| Año (`cmbAnios`)       | ✅                  | ✅     | ✅                   |
| Patente (`txtPatente`) | ✅                  | ❌     | ❌                   |
| Valor (`txtDocumento`) | ✅ número pedimento | ✅ VIN | ✅ número contenedor |

### `ResultadosTabla.tsx`

Columnas de la tabla:

| Columna                   | Fuente del dato                                                       |
| ------------------------- | --------------------------------------------------------------------- |
| Identificador (Documento) | `resultado.documento`                                                 |
| Estado                    | `resultado.estado` — renderizado como `<Badge>` con color según valor |
| Fecha                     | `resultado.fecha`                                                     |
| Detalle                   | `<Button>` que navega a `/detalle/${resultado.id}`                    |

- Filas ordenadas por fecha descendente
- Si no hay resultados: estado vacío con mensaje ilustrativo
- Botón "Limpiar tabla" en el header de la tabla

### `DetallePedimento.tsx`

Card con dos columnas de datos:

```
Documento          | Aduana
Año                | Patente
Número Pedimento   | Situación del Pedimento
Estado             | Fecha
Número de Operación
```

### `DetalleEstadoPago.tsx`

Card separada debajo de `DetallePedimento`:

```
Banco              | Monto
Número de Operación| Fecha de Pago
Línea de Captura   | Estado
Línea de Captura (secundaria, si aplica)
```

---

## Configuración Vite (`vite.config.ts`)

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
```

Con esto el frontend puede llamar a `/api/cep/consultar` sin especificar host,
y Vite redirige al proxy Express en desarrollo.

---

## Scripts `package.json`

```json
{
  "scripts": {
    "dev": "concurrently \"vite\" \"node proxy-server/index.js\"",
    "build": "vite build",
    "proxy": "node proxy-server/index.js"
  }
}
```

`concurrently` levanta el frontend (puerto 5173) y el proxy (puerto 3001) en paralelo.

---

## Rutas React Router

| Ruta           | Componente     | Descripción                     |
| -------------- | -------------- | ------------------------------- |
| `/`            | `ConsultaPage` | Formulario + tabla acumulada    |
| `/detalle/:id` | `DetallePage`  | Detalle completo de un registro |

---

## Flujo de Datos Completo

```
Usuario llena form
    ↓
ConsultaForm.onSubmit()
    ↓
cepApi.consultar(params)  →  POST /api/cep/consultar (Vite proxy)
    ↓
proxy-server/routes/cep.js
    ↓
scraper/client.js  →  GET inicial al SAT (obtiene tokens de sesión)
    ↓
scraper/client.js  →  POST al SAT con params del usuario
    ↓
scraper/parser.js  →  parsea HTML con cheerio → CepDetalle[]
    ↓
Response JSON: CepResultadoResumen[]
    ↓
useResultsStore.agregarResultados()
    ↓
ResultadosTabla re-renderiza con nuevas filas
    ↓
Usuario hace clic en "Detalle"
    ↓
React Router navega a /detalle/:id
    ↓
DetallePage lee store → renderiza DetallePedimento + DetalleEstadoPago
```

---

## Consideraciones Técnicas Importantes

### Sesión SAT

El portal SAT usa ASP.NET WebForms con `__VIEWSTATE` y `__EVENTVALIDATION`.
El proxy debe:

1. Hacer un GET inicial para obtener las cookies de sesión y los campos ocultos
2. Incluir esos campos en el POST de consulta
3. Mantener las cookies entre peticiones con `axios.create({ jar: true })` o `got` con cookie jar

### Campos del formulario SAT — Payload confirmado por inspección de red

El POST al portal SAT debe incluir **exactamente** estos campos (confirmados vía DevTools):

| Campo `name`           | Descripción                            | Notas                                                  |
| ---------------------- | -------------------------------------- | ------------------------------------------------------ |
| `__EVENTTARGET`        | Evento ASP.NET                         | Vacío en submit normal                                 |
| `__EVENTARGUMENT`      | Argumento del evento                   | Vacío en submit normal                                 |
| `__VIEWSTATE`          | Token de sesión (largo, base64)        | **Se obtiene del GET inicial — cambia por sesión**     |
| `__VIEWSTATEGENERATOR` | Sub-token                              | Valor observado: `EF99AA13` — verificar si es fijo     |
| `__EVENTVALIDATION`    | Validación de eventos (base64)         | **Se obtiene del GET inicial — cambia por sesión**     |
| `txtCaptcha`           | Campo CAPTCHA                          | ✅ **Puede enviarse vacío — el servidor no lo valida** |
| `cmbAduanas`           | Código de aduana                       | Ej: `510`                                              |
| `cmbAnios`             | Año del pedimento                      | Ej: `2026`                                             |
| `txtPatente`           | Número de patente                      | Ej: `3475`                                             |
| `txtDocumento`         | Número de pedimento / VIN / contenedor | Ej: `5000412`                                          |
| `tpoConsulta`          | **Tipo de consulta**                   | Ver tabla de valores abajo                             |
| `cmdBuscar`            | Botón submit                           | Valor fijo: `Buscar`                                   |

#### Valores de `tpoConsulta` por método

| Método     | Valor confirmado | Valor probable (pendiente verificar)                  |
| ---------- | ---------------- | ----------------------------------------------------- |
| Pedimento  | `rblPatente`     | ✅ Confirmado                                         |
| VIN        | —                | `rblVin` (pendiente confirmar con prueba real)        |
| Contenedor | —                | `rblContenedor` (pendiente confirmar con prueba real) |

> **TODO:** Hacer una consulta por VIN y una por Contenedor en el portal con DevTools abierto
> para confirmar el valor exacto de `tpoConsulta` en cada caso antes de implementar el scraper.

#### Lógica del scraper `client.js` — flujo real

```js
// PASO 1: GET inicial → obtener cookies de sesión + tokens ASP.NET
const response = await axios.get(
  "https://aplicacionesc.mat.sat.gob.mx/SOIA_CR_WEB/oia_consultarap_cep.aspx",
  {
    headers: { "User-Agent": "..." },
  },
);
// Extraer con cheerio:
// __VIEWSTATE         → input[name="__VIEWSTATE"][value]
// __VIEWSTATEGENERATOR → input[name="__VIEWSTATEGENERATOR"][value]
// __EVENTVALIDATION   → input[name="__EVENTVALIDATION"][value]
// Cookie              → response.headers['set-cookie']  (ASP.NET_SessionId)

// PASO 2: POST con el formulario completo
const postBody = new URLSearchParams({
  __EVENTTARGET: "",
  __EVENTARGUMENT: "",
  __VIEWSTATE: tokens.viewState,
  __VIEWSTATEGENERATOR: tokens.viewStateGenerator,
  __EVENTVALIDATION: tokens.eventValidation,
  txtCaptcha: "", // vacío — no se valida
  cmbAduanas: params.aduana ?? "", // pedimento y contenedor; vacío para VIN
  cmbAnios: params.anio ?? "", // pedimento, VIN y contenedor
  txtPatente: params.patente ?? "",
  txtDocumento: params.valor,
  tpoConsulta: tpoConsultaMap[params.metodo], // 'rblPatente' | 'rblVin' | 'rblContenedor'
  cmdBuscar: "Buscar",
});

const result = await axios.post(
  "https://aplicacionesc.mat.sat.gob.mx/SOIA_CR_WEB/oia_consultarap_cep.aspx",
  postBody.toString(),
  {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: sessionCookie,
      Referer:
        "https://aplicacionesc.mat.sat.gob.mx/SOIA_CR_WEB/oia_consultarap_cep.aspx",
      "User-Agent": "Mozilla/5.0 ...",
    },
  },
);
// Pasar result.data (HTML) al parser.js
```

#### Mapeo de métodos → `tpoConsulta`

```js
// proxy-server/scraper/client.js
const tpoConsultaMap = {
  pedimento: "rblPatente",
  vin: "rblVin", // pendiente confirmar
  contenedor: "rblContenedor", // pendiente confirmar
};
```

### Sesión SAT — flujo GET + POST por consulta

Cada llamada al proxy realiza dos peticiones en secuencia:

1. **GET** a `oia_consultarap_cep.aspx` → extrae con cheerio:
   - `input[name="__VIEWSTATE"]` → `value`
   - `input[name="__VIEWSTATEGENERATOR"]` → `value`
   - `input[name="__EVENTVALIDATION"]` → `value`
   - Header `set-cookie` → guarda `ASP.NET_SessionId`

2. **POST** a la misma URL con el body `application/x-www-form-urlencoded` incluyendo los tokens del paso 1 y la cookie.

No es necesario mantener un cookie jar persistente entre consultas; cada par GET+POST es autocontenido.

### CAPTCHA

✅ **Confirmado:** El campo `txtCaptcha` se puede enviar vacío. El servidor SAT **no valida** el captcha en el POST. No se requiere ningún servicio de resolución de captchas.

### CORS

El proxy Express tiene CORS habilitado solo para `http://localhost:5173` en desarrollo.
Para producción se deberá ajustar el origen permitido.

### Manejo de errores del portal

- Si el SAT devuelve "No se encontraron registros": el parser devuelve `[]` (array vacío)
- Si hay error de sesión/timeout: el proxy devuelve `{ error: 'SESSION_ERROR' }` y el frontend muestra mensaje
- Reintentos automáticos: no implementados en v1, el usuario puede volver a consultar

---

## Orden de Implementación Sugerido

1. Scaffolding Vite + instalación de dependencias
2. Tipos TypeScript (`src/types/cep.ts`)
3. Store Zustand
4. Proxy Express básico con respuesta mockeada (datos hardcodeados)
5. `ConsultaForm` + `ResultadosTabla` con datos mock
6. Routing y `DetallePage` con datos mock
7. Implementar scraper real en el proxy:
   - `client.js`: GET inicial → extraer tokens → POST con payload confirmado
   - `parser.js`: parsear HTML de respuesta con cheerio
   - Confirmar valores de `tpoConsulta` para VIN y Contenedor
8. Conectar API client al proxy real (reemplazar mock)
9. Polish de UI y manejo de errores

---

## Constantes SAT (`src/constants/satOptions.ts`)

Valores extraídos directamente del HTML del portal SAT. **No hacer fetch al SAT para obtenerlos — están hardcodeados aquí.**

```typescript
export const SAT_OPTIONS = {
  aduanas: [
    { value: "-10", label: "-" },
    { value: "10", label: "ACAPULCO, GRO." },
    { value: "6660", label: "ADUANA VIRTUAL PARA PREVALIDADORES" },
    { value: "470", label: "AEROPUERTO INTERNAL. CD. DE MEXICO, D.F." },
    { value: "850", label: "AEROPUERTO INTERNAL. FELIPE ANGELES, MEX" },
    { value: "20", label: "AGUA PRIETA, SON." },
    { value: "730", label: "AGUASCALIENTES, AGS." },
    { value: "810", label: "ALTAMIRA, TAMPS." },
    { value: "530", label: "CANCUN, Q. ROO." },
    { value: "440", label: "CD. ACUNA, COAH." },
    { value: "820", label: "CD. CAMARGO, TAMPS." },
    { value: "60", label: "CD. DEL CARMEN, CAMP." },
    { value: "370", label: "CD. HIDALGO, CHIS." },
    { value: "70", label: "CD. JUAREZ, CHIH." },
    { value: "340", label: "CD. MIGUEL ALEMAN, TAMPS." },
    { value: "300", label: "CD. REYNOSA, TAMPS." },
    { value: "670", label: "CHIHUAHUA, CHIH." },
    { value: "80", label: "COATZACOALCOS, VER." },
    { value: "800", label: "COLOMBIA, N.L." },
    { value: "830", label: "DOS BOCAS" },
    { value: "110", label: "ENSENADA, B.C." },
    { value: "480", label: "GUADALAJARA, JAL." },
    { value: "840", label: "GUANAJUATO, GTO" },
    { value: "120", label: "GUAYMAS, SON." },
    { value: "140", label: "LA PAZ, B.C.S." },
    { value: "510", label: "LAZARO CARDENAS, MICH." },
    { value: "160", label: "MANZANILLO, COL." },
    { value: "170", label: "MATAMOROS, TAMPS." },
    { value: "180", label: "MAZATLAN, SIN." },
    { value: "190", label: "MEXICALI, B.C." },
    { value: "200", label: "MEXICO" },
    { value: "520", label: "MONTERREY, N.L." },
    { value: "220", label: "NACO, SON." },
    { value: "230", label: "NOGALES, SON." },
    { value: "240", label: "NUEVO LAREDO, TAMPS." },
    { value: "250", label: "OJINAGA, CHIH." },
    { value: "270", label: "PIEDRAS NEGRAS, COAH." },
    { value: "280", label: "PROGRESO, YUC." },
    { value: "750", label: "PUEBLA, PUE." },
    { value: "260", label: "PUERTO PALOMAS, CHIH." },
    { value: "640", label: "QUERETARO, QRO." },
    { value: "310", label: "SALINA CRUZ, OAX." },
    { value: "330", label: "SAN LUIS RIO COLORADO, SON." },
    { value: "500", label: "SONOYTA, SON." },
    { value: "50", label: "SUBTENIENTE LOPEZ, Q. ROO." },
    { value: "380", label: "TAMPICO, TAMPS." },
    { value: "390", label: "TECATE, B.C." },
    { value: "400", label: "TIJUANA, B.C." },
    { value: "650", label: "TOLUCA, MEX." },
    { value: "460", label: "TORREON, COAH." },
    { value: "420", label: "TUXPAN, VER." },
    { value: "430", label: "VERACRUZ, VER." },
  ],

  anios: [
    { value: "2017", label: "2017" },
    { value: "2018", label: "2018" },
    { value: "2019", label: "2019" },
    { value: "2020", label: "2020" },
    { value: "2021", label: "2021" },
    { value: "2022", label: "2022" },
    { value: "2023", label: "2023" },
    { value: "2024", label: "2024" },
    { value: "2025", label: "2025" },
    { value: "2026", label: "2026" },
  ],
} as const;

// Defaults que refleja el portal SAT al cargar la página
export const SAT_DEFAULTS = {
  aduana: "510", // LAZARO CARDENAS, MICH. — selected="selected" en el HTML
  anio: "2026", // año actual — selected="selected" en el HTML
} as const;

export type AduanaValue = (typeof SAT_OPTIONS.aduanas)[number]["value"];
export type AnioValue = (typeof SAT_OPTIONS.anios)[number]["value"];
```

> **Nota sobre años futuros:** El portal agrega el año actual al cargar.
> Si la app se usa en 2027+, agregar `{ value: '2027', label: '2027' }` a `anios`.
