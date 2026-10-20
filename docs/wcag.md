# Accesibilidad — WCAG 2.2 nivel AA

El MVP persigue el **nivel AA** de las WCAG 2.2. Este documento es una matriz de
trazabilidad criterio → implementación → evidencia. No sustituye una auditoría
formal con usuarios y productos de apoyo.

## 1. Decisiones de diseño

- **Color con significado redundante.** La urgencia crítica no se comunica solo con
  rojo: añade borde, icono y la palabra **"Crítico"** (criterio 1.4.1).
- **Contraste verificado.** Las combinaciones del tema están documentadas y
  comprobadas (ver tabla más abajo).
- **Foco siempre visible.** Contorno de 3 px con desplazamiento, apto tanto en
  fondos claros como en la superficie oscura de la pantalla (2.4.7 / 1.4.11).
- **Movimiento respetuoso.** Si el sistema pide "movimiento reducido", la rotación
  de la pantalla arranca **pausada** (2.3.3).
- **Nada solo con ratón.** Todo control es alcanzable y operable con teclado (2.1.1).
- **Mensajes anunciados.** Cargas, errores y cambios de página se comunican a los
  lectores de pantalla con regiones `aria-live` (4.1.3).

## 2. Relaciones de contraste (criterio 1.4.3)

| Primer plano | Fondo | Relación | Nivel |
| ------------ | ----- | -------- | ----- |
| `brand-700` `#15803d` | blanco | 5.02:1 | AA (texto normal) |
| `urgent-700` `#b91c1c` | blanco | 6.54:1 | AA / AAA |
| blanco | `brand-700` `#15803d` | 5.02:1 | AA |
| blanco | `urgent-700` `#b91c1c` | 6.54:1 | AA |
| `slate-900` `#0f172a` | blanco | 17.8:1 | AAA |
| blanco | superficie oscura `#05231a` (pantalla) | ≥ 7:1 | AAA |

Fuente: `client/src/styles/global.css` (encabezado con la justificación) y
`client/src/models/priority.ts` (clases estáticas por urgencia).

## 3. Matriz de criterios (nivel A y AA)

### Perceptible

| Criterio | Nivel | Implementación | Evidencia |
| -------- | ----- | -------------- | --------- |
| 1.1.1 Contenido no textual | A | Iconos decorativos con `aria-hidden`; insignias con texto; sin imágenes con significado. | `views/shared/PriorityBadge.tsx`, `views/layouts/AppLayout.tsx` |
| 1.3.1 Información y relaciones | A | Regiones `header`/`nav`/`main`/`footer`; tablas con `th`/`scope`; listas semánticas. | `views/layouts/AppLayout.tsx`, `views/admin/*` |
| 1.3.2 Secuencia significativa | A | El orden del DOM coincide con el orden visual; sin reordenaciones por CSS. | `views/**` |
| 1.3.4 Orientación | AA | Diseño flexible; no se bloquea la orientación. | clases responsivas Tailwind |
| 1.3.5 Identificar el propósito del campo | AA | Cada control tiene `<label for>` y tipo adecuado. | `views/shared/Field.tsx` |
| 1.4.1 Uso del color | A | La urgencia crítica añade borde + icono + texto "Crítico". | `styles/global.css` (`.badge--critical`), `models/priority.ts` |
| 1.4.3 Contraste (mínimo) | AA | Combinaciones ≥ 4.5:1 (ver tabla §2). | `styles/global.css` |
| 1.4.4 Redimensionar el texto | AA | Unidades relativas (`rem`) y `em`; el texto escala hasta 200 % sin pérdida. | `styles/global.css` |
| 1.4.10 Reflujo | AA | Rejilla responsiva sin desplazamiento horizontal a 320 px. | clases `flex-wrap`/`grid` en `views/**` |
| 1.4.11 Contraste de elementos no textuales | AA | Contorno de foco y bordes con contraste ≥ 3:1. | `styles/global.css` (`:focus-visible`) |
| 1.4.12 Espaciado del texto | AA | Sin alturas fijas que recorten el texto. | `views/**` |
| 1.4.13 Contenido en hover o foco | AA | Las ayudas son texto persistente, no *tooltips* dependientes del puntero. | `views/shared/Field.tsx` |

### Operable

| Criterio | Nivel | Implementación | Evidencia |
| -------- | ----- | -------------- | --------- |
| 2.1.1 Teclado | A | Controles nativos (`button`, `a`, `input`, `select`). | `views/**` |
| 2.1.2 Sin trampa de teclado | A | `Escape` cancela la confirmación y devuelve el foco; sin trampas. | `views/shared/ConfirmAction.tsx` |
| 2.1.4 Atajos de teclado | A | Los atajos (Espacio, ←/→) solo existen en la superficie de pantalla, sin campos editables. | `views/display/DisplayView.tsx` |
| 2.2.1 Tiempo ajustable | A | La rotación puede pausarse; los formularios no caducan. | `views/display/DisplayView.tsx` |
| 2.2.2 Pausar, detener, ocultar | A | Botón visible de pausa/continúa y tecla `Espacio`; navegación manual. | `views/display/DisplayView.tsx` |
| 2.3.1 Tres destellos | A | Sin contenido parpadeante ni destellos. | `views/**` |
| 2.4.1 Evitar bloques | A | Enlace "Saltar al contenido principal" como primer elemento. | `views/layouts/AppLayout.tsx` (`.skip-link`) |
| 2.4.2 Título de la página | A | `document.title` se actualiza por ruta. | `views/layouts/AppLayout.tsx` |
| 2.4.3 Orden del foco | A | Al cambiar de página el foco va a `<main>`; al confirmar, al botón de confirmación. | `AppLayout.tsx`, `ConfirmAction.tsx` |
| 2.4.4 Propósito del enlace | A | Textos de enlace descriptivos (sin "clic aquí"). | `views/**` |
| 2.4.6 Encabezados y etiquetas | AA | Jerarquía de encabezados y etiquetas descriptivas por campo. | `views/**`, `views/shared/Field.tsx` |
| 2.4.7 Foco visible | AA | `:focus-visible` con contorno de 3 px. | `styles/global.css` |
| 2.4.11 Foco no oculto (mínimo) | AA | Sin barras adhesivas que tapen el elemento enfocado. | `views/layouts/AppLayout.tsx` |
| 2.5.1 Gestos del puntero | A | No hay gestos de trazo (*swipe*); todo es clic/tecla. | `views/**` |
| 2.5.3 Etiqueta en el nombre | A | El nombre accesible coincide con el texto visible de los botones. | `views/**` |
| 2.5.7 Movimientos de arrastre | AA | No se requiere arrastrar. | `views/**` |
| 2.5.8 Tamaño del objetivo (mínimo) | AA | Botones con relleno suficiente (≥ 24×24 px) y separación entre acciones. | `styles/global.css` (`.btn`) |

### Comprensible

| Criterio | Nivel | Implementación | Evidencia |
| -------- | ----- | -------------- | --------- |
| 3.1.1 Idioma de la página | A | `lang="es"` en el documento. | `client/index.html` |
| 3.2.1 Al recibir el foco | A | Enfocar no cambia de contexto. | `views/**` |
| 3.2.2 Al introducir datos | A | Los formularios se envían con un botón explícito. | `views/admin/AnnouncementFormView.tsx` |
| 3.2.6 Ayuda coherente | A | Ayudas y mensajes con la misma ubicación y estilo en todo el panel. | `views/shared/Field.tsx`, `views/shared/StatusMessage.tsx` |
| 3.3.1 Identificación de errores | A | Errores de campo en texto y con `role="alert"`. | `views/shared/Field.tsx`, `views/shared/StatusMessage.tsx` |
| 3.3.2 Etiquetas o instrucciones | A | Etiqueta + ayuda por campo; obligatoriedad marcada. | `views/shared/Field.tsx` |
| 3.3.3 Sugerencia ante errores | AA | Los mensajes describen cómo corregir (p. ej. longitud mínima, formato de fecha). | `validation/schemas.ts` (mensajes) |
| 3.3.4 Prevención de errores | AA | Confirmación en dos pasos antes de eliminar, con el objeto afectado nombrado. | `views/shared/ConfirmAction.tsx` |
| 3.3.7 Entrada redundante | A | Los datos ya introducidos no se piden de nuevo. | `views/admin/*` |

### Robusto

| Criterio | Nivel | Implementación | Evidencia |
| -------- | ----- | -------------- | --------- |
| 4.1.2 Nombre, rol, valor | A | Componentes nativos; ARIA solo donde aporta (`role="status"`, `role="alert"`, `role="group"`). | `views/shared/*` |
| 4.1.3 Mensajes de estado | AA | Regiones `aria-live` para carga, error, conexión y cambio de página. | `StatusMessage.tsx`, `ConnectionIndicator.tsx`, `AppLayout.tsx`, `DisplayView.tsx` |

## 4. Criterios AAA aplicados de forma voluntaria

| Criterio | Implementación |
| -------- | -------------- |
| 2.3.3 Animación de las interacciones | Con "movimiento reducido" la rotación arranca pausada (`views/display/DisplayView.tsx`, `useRotation.ts`). |
| 1.4.6 Contraste (mejorado) | Superficie de pantalla con texto blanco sobre fondo oscuro ≥ 7:1. |

## 5. Verificación recomendada

Pruebas manuales sugeridas para validar el MVP:

1. **Teclado:** recorrer todas las vistas solo con `Tab`/`Shift+Tab`/`Enter`/`Espacio`.
2. **Lector de pantalla:** NVDA (Windows) o VoiceOver (macOS) sobre login, alta de
   anuncio, borrado (confirmación) y la pantalla de emisión.
3. **Zoom/reflujo:** 200 % de zoom y ventana a 320 px de ancho.
4. **Movimiento reducido:** activar la preferencia del sistema y comprobar que la
   pantalla arranca pausada.
5. **Contraste:** verificar los colores con un medidor (los valores de §2 ya están
   calculados).

## 6. Limitaciones conocidas

- La prueba con usuarios reales y productos de apoyo no forma parte del alcance del MVP.
- La pantalla de emisión prioriza la legibilidad a distancia; sus tamaños de fuente
  son grandes por diseño, no un incumplimiento de 1.4.4.
