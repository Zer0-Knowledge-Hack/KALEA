# Kalea

Kalea es una propuesta de intercambio P2P entre **USDC en Stellar y bolivianos (BOB)**. El primer mercado propuesto es Bolivia. El objetivo es que una persona pueda comprar o vender USDC, comparar cuánto recibe con cada oferta y completar el intercambio con un método de pago local.

Este README es el punto de entrada para retomar el proyecto en otro entorno y preparar su postulación al **Stellar Community Fund (SCF)**. Distingue el estado del código de las decisiones y los entregables propuestos.

- [Repositorio de KALEA](https://github.com/Zer0-Knowledge-Hack/KALEA)
- [Rama de trabajo del prototipo](https://github.com/Zer0-Knowledge-Hack/KALEA/tree/codex/kalea-mobile-frontend)
- [Demo privada de Sites](https://kalea-prueba-landing.wyucram96.chatgpt.site/#intercambio)

La demo privada requiere iniciar sesión y fue publicada por separado. Para reproducir la versión de esta rama, usa la ejecución local de abajo. Verifica el acceso y la revisión desplegada antes de usar la URL como evidencia.

## Plataforma (monorepo pnpm)

```text
KALEA/
├── apps/
│   ├── web/        # Next.js 16 + Tailwind 4 + Motion · landing y app (/app)
│   └── api/        # Hono · cotizaciones, órdenes y login SEP-10 (JWT)
├── packages/
│   └── shared/     # Tipos de dominio y datos demo compartidos
├── contracts/      # (pendiente) escrow Soroban
├── legacy/         # Prototipo HTML original
└── brand/
```

**Login:** wallet Stellar (Freighter). El API emite un reto SEP-10 (`GET /auth/challenge`), la wallet lo firma y `POST /auth/token` devuelve un JWT para las rutas protegidas (`/orders`). Sin custodia ni contraseñas.

**Diseño:** paleta negro `#0A0A0A`, lima `#C8F23A`, coral `#FF7A70`; tipografías Schibsted Grotesk y JetBrains Mono.

```sh
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm dev   # web :3000 · api :8787
```

## 1. Qué estamos construyendo

**Usuario inicial propuesto.** Personas en Bolivia que ya reciben, mantienen o necesitan USDC y quieren convertirlo a BOB o comprarlo con medios de pago que conocen. El segundo perfil es el operador P2P que publica condiciones, acepta órdenes y ejecuta su parte del intercambio.

**Hipótesis de problema.** Comparar ofertas dispersas y entender el monto final, el método local y quién debe actuar puede tomar más esfuerzo del necesario. Esta hipótesis requiere entrevistas y pruebas con ambos perfiles.

**Propuesta de valor.** Mostrar las ofertas elegibles para un monto y un medio de pago, ordenadas por el monto que recibe el usuario, y guiarlo desde la cotización hasta el seguimiento de la orden.

**Referencias.** P2P.me se usó para estudiar compra, venta y operadores que usan medios de pago locales. Koul se revisó en Playwright a 390 px como referencia de jerarquía visual, animación y estados del producto. La propuesta de Kalea combina un primer flujo BOB/USDC, foco móvil y liquidación prevista en Stellar. La diferenciación comercial y la demanda siguen por validar. [P2P.me](https://www.p2p.me/es) · [Koul](https://koul.me/)

## 2. Estado del proyecto

| Área | Implementado en la rama | Pendiente para un piloto |
| --- | --- | --- |
| Marca | Exploraciones de logo y paletas, con **Cacao y maíz** como dirección de la landing | Aprobar el logo final y consolidar sus variantes |
| Landing | HTML adaptable, cotizador, sección explicativa, estados y animaciones con movimiento reducido | Revisar usabilidad con usuarios y publicar una revisión reproducible para evaluadores |
| Cotización | Compra y venta, operadores simulados, QR Simple y transferencia, límites por oferta, orden por monto recibido y actualización manual de escenarios | Ofertas reales, disponibilidad, comisiones explícitas, comparación por monto neto y expiración |
| Orden | Revisión con operador, método, tasa y montos. Seguimiento simulado según compra o venta | Persistencia, identidad, aceptación por contraparte, cancelación y registro de eventos |
| Stellar | Stellar y USDC forman parte del diseño del producto | Wallet, activo verificado, transacción en testnet, escrow y evidencias públicas |
| Pago local | Selección ilustrativa de QR Simple o transferencia | Validar método, datos de pago, confirmación, fraude y disputas |
| Postulación | Prototipo y material visual en el repo | Confirmar capítulo, convocatoria, equipo, métricas, presupuesto y acceso al paquete |

Las ofertas del simulador son ejemplos. El valor del BCB mostrado en la página es una referencia fechada del **7 de noviembre de 2026** expresada en **BOB por USD**. Las ofertas del prototipo se expresan en **BOB por USDC**. Para un entorno real, registra fecha, origen y moneda de cada valor. Conserva el dato oficial separado del precio ejecutable de un operador. [Banco Central de Bolivia](https://www.bcb.gob.bo/librerias/indicadores/dolar/bolsin.php)

## 3. Estructura actual

```text
KALEA/
├── README.md
├── LICENSE                         # Apache 2.0
├── index.html                      # Landing, estilos y simulador en un archivo
└── brand/
    ├── kalea-exploracion-logo.png
    ├── kalea-exploracion-logo-ronda-02.png
    ├── kalea-identidad-visual-ronda-03.jpg
    ├── kalea-identidad-visual-ronda-03.png
    ├── kalea-paletas-ronda-04.jpg
    ├── kalea-logo-01.svg … kalea-logo-09.svg
    ├── kalea-logo-cerca-de-ti.svg
    ├── kalea-logo-pulso-digital.svg
    └── kalea-logo-red-abierta.svg
```

En [index.html](index.html), el CSS contiene la paleta, el diseño adaptable y las animaciones. El formulario `#exchange` contiene cotización, revisión y seguimiento. En el script, `operators` contiene escenarios de prueba, `inputAmount()` valida el monto, `update()` filtra y ordena las ofertas, y `show()` cambia el paso y mueve el foco al encabezado. Al confirmar la cotización, la revisión conserva los valores de la oferta elegida.

La landing funciona sin instalación de paquetes, variables de entorno, compilación ni servidor de aplicación. El estado vive en la página y se reinicia al recargar. La propuesta inicial de **Cloudflare Pages** para la landing y **Flutter/Dart** para una app futura sigue siendo una decisión de arquitectura. Esta rama contiene el prototipo web.

## 4. Retomar el trabajo en otro entorno

```sh
git clone --branch codex/kalea-mobile-frontend https://github.com/Zer0-Knowledge-Hack/KALEA.git
cd KALEA
python -m http.server 8080 --bind 127.0.0.1
```

Abre `http://127.0.0.1:8080/#intercambio`. También puedes abrir `index.html` directamente en el navegador. Usa la rama indicada o una revisión que ya contenga sus cambios.

1. En **Comprar USDC**, ingresa BOB, selecciona **QR Simple** y elige la oferta alternativa. Comprueba que el monto y operador coincidan en la revisión.
2. Pulsa **Simular orden** y verifica que el paso pendiente sea el pago en BOB. Regresa al cotizador y repite con **Vender USDC**.
3. Cambia a **Transferencia bancaria** y pulsa **Actualizar demo** para observar cómo cambian las ofertas elegibles. Prueba también un monto inválido y uno fuera del límite.
4. Revisa a **390 px**, en escritorio y con teclado. Activa movimiento reducido y comprueba que el flujo siga siendo utilizable.

Se probó en Playwright a 390 px la selección de una oferta de compra, su revisión, el seguimiento simulado y la opción de movimiento reducido. Para el paquete de postulación, registra el SHA probado y guarda capturas de compra y venta de la misma versión.

### Continuidad de diseño y desarrollo

- Usa la lámina [Cacao y maíz](brand/kalea-paletas-ronda-04.jpg) como referencia. La exploración define cacao `#40271E`, crema `#FBF3E3` y maíz `#F6C54B`. El tema oscuro aplicado vive en el CSS de la landing.
- Conserva una acción principal por paso. Muestra monedas junto a cada monto y el estado de la orden con texto. Revisa foco, contraste, tamaño táctil y preferencia de movimiento reducido.
- Parte de la rama que contiene el prototipo, crea una rama por cambio y registra en el PR cómo probarlo. Usa `git diff --check` y un recorrido funcional antes de subir.
- Mantén la landing reproducible desde el repositorio. Si se configura Cloudflare Pages, define la rama de despliegue y un directorio estático que contenga `index.html`. Verifica la URL en una sesión externa y registra el SHA. La instancia de Sites es una vista privada previa.
- Usa datos ficticios en capturas y videos. Conserva secretos, llaves y datos de usuarios en un entorno autorizado fuera de Git.

## 5. Arquitectura propuesta y alcance del MVP

Se propone evolucionar en tres piezas. Primero, el frontend de cotización y seguimiento. Segundo, una API con base de datos para operadores, ofertas, órdenes y eventos. Tercero, Stellar para la parte de USDC, inicialmente en testnet. Documenta la decisión de infraestructura antes de introducir nuevos servicios. Si se adopta Flutter/Dart para la app, reutiliza el contrato de API y las reglas del flujo.

**Flujo objetivo.**

1. El operador registra método, precio, límites y capacidad disponible. El usuario elige dirección, monto y método.
2. El sistema filtra ofertas elegibles y ordena por **monto neto recibido**. La cotización muestra tasa, comisiones, totales y vigencia.
3. El usuario acepta una cotización vigente. El backend crea una orden con una copia de sus condiciones y reserva disponibilidad de forma atómica. Los reintentos deben recuperar la misma orden y evitar duplicados.
4. La parte que aporta USDC bloquea los fondos según el mecanismo de escrow que se apruebe. La contraparte realiza el pago fiat por el canal local.
5. La persona que recibe el fiat confirma según el proceso acordado. Se registra la liberación, el reembolso o la disputa con un historial de eventos y, cuando corresponda, un hash de Stellar.
6. El usuario consulta el estado, la siguiente acción y el comprobante aplicable.

**Compra y venta.** En compra, el usuario entrega BOB y el operador aporta USDC. En venta, el usuario aporta USDC y el operador envía BOB. La interfaz debe mostrar quién actúa en cada etapa. El pago fiat ocurre fuera de Stellar y requiere un mecanismo de confirmación separado. Una captura sirve como evidencia para revisar, junto con el proceso de confirmación que se defina.

**Entidades mínimas propuestas.** `Operator` para disponibilidad y métodos. `Offer` para dirección, precio, comisión, límites y capacidad. `Quote` para condiciones y vencimiento. `Order` para partes, condiciones congeladas, estado y referencias de transacción. `OrderEvent` para acción, actor, fecha y evidencia. Guarda montos como unidades enteras o decimales exactos y define reglas de redondeo por moneda.

**Estados propuestos.** `awaiting_usdc` → `awaiting_fiat` → `awaiting_confirmation` → `released`. Define además los caminos de expiración, cancelación, disputa y reembolso. Para cada transición, especifica quién puede ejecutarla, cuándo vence, qué ocurre en un reintento y qué evidencia se guarda.

**Decisiones antes de mover fondos.** Verificar red y emisor del activo USDC, definir custodia y permisos, diseñar los plazos del escrow, revisar el tratamiento de datos y requisitos aplicables con el equipo responsable, y acordar un proceso de disputas y soporte. Usar testnet y montos ficticios hasta completar las validaciones para un piloto.

## 6. Cómo preparar la postulación

Usa **Instawards** como hipótesis inicial para la fase de prototipo y validación. El SCF describe esta vía como incubación temprana impulsada por capítulos regionales de Stellar Ambassadors. Confirma con el capítulo y el portal qué convocatoria corresponde, qué condiciones y entregables aplican, cómo se presenta y si existe una fecha vigente. Evalúa **SCF Build** en función de la evidencia y la etapa real del producto. [Stellar Community Fund](https://communityfund.stellar.org/) · [SCF 7.0](https://stellar.org/blog/ecosystem/introducing-scf-v7)

| Bloque | Qué incluir | Evidencia que falta completar |
| --- | --- | --- |
| Problema | Quién intercambia BOB/USDC hoy y dónde se traba | Entrevistas con usuarios y operadores, con hallazgos fechados |
| Solución | Comparación de ofertas y seguimiento de compra y venta | Demo accesible, capturas móviles y un video breve |
| Uso de Stellar | USDC como activo de liquidación y trazabilidad de la parte on-chain. Soroban si se implementa escrow | Diagrama con la frontera fiat/on-chain, pruebas y hashes de testnet cuando existan |
| Mercado inicial | Bolivia, métodos priorizados y perfil de usuario | Operadores interesados, evidencia de demanda y plan de reclutamiento |
| Equipo | Integrantes, rol, experiencia y disponibilidad | Confirmación de responsables y enlaces verificables |
| Hitos y presupuesto | Entregables, criterios de aceptación, costo, plazo y responsable | Estimación en horas, proveedores y monto aprobado internamente |
| Riesgos | Liquidez, precio, fraude, confirmación fiat y disputas | Estrategia de mitigación, responsables y supuestos por validar |

### Hitos propuestos

1. **Validación y prototipo.** Entrevistar ambos perfiles, probar la cotización móvil y documentar qué funciona y qué genera dudas. Entregar una demo reproducible, capturas y registro de cambios derivados de las pruebas.
2. **MVP en testnet.** Implementar ofertas y órdenes persistentes, confirmar vigencia de cotizaciones y conectar una wallet de prueba. Demostrar una compra y una venta, con resultados verificables y casos de expiración o reintento.
3. **Piloto acotado.** Acordar condiciones con operadores, validar el medio de pago y el proceso de confirmación, y medir el recorrido. Habilitar operaciones reales según los controles y aprobaciones del equipo.

Antes de fijar objetivos numéricos, captura una línea base. Métricas sugeridas para el piloto: porcentaje de cotizaciones con oferta disponible, porcentaje de órdenes completadas, tiempo hasta completar, diferencia entre cotización y monto final, y cantidad de cancelaciones o disputas. Indica período, denominador y fuente de cada métrica.

### Texto base para el formulario

> Kalea is a mobile-first peer-to-peer exchange prototype for buying and selling USDC on Stellar with Bolivian bolivianos. The demo lets users compare simulated offers by the amount they receive, choose a local payment method and review an example order. We plan to validate demand with users and operators in Bolivia, then demonstrate a testnet flow for the USDC leg while keeping local fiat settlement explicit in the product experience.

### Guion de demo y verificación final

1. Presenta en una frase el problema y muestra la landing en móvil.
2. Ingresa un monto en BOB y compara dos ofertas de compra. Selecciona una y enseña tasa, método y monto final.
3. Simula la orden y señala quién debe actuar. Muestra brevemente la dirección inversa, USDC a BOB.
4. Cierra con el hito financiable, la evidencia que se entregará y la distinción entre simulación y trabajo de testnet.
5. Revisa la demo con una sesión externa, verifica permisos del repo y del video, confirma los datos del equipo y reemplaza estimaciones pendientes por cifras aprobadas. Envía la postulación por el canal confirmado del programa.

## 7. Historial de referencia

| Commit | Trabajo |
| --- | --- |
| `5954796` | Prototipo móvil y recursos de marca |
| `e118c9d` | Comparación en tarjetas, mejora de seguimiento y corrección de botones en móvil |
| `ff0ba6f` | Animación del hero, transiciones del cotizador y movimiento reducido |

Licencia del repositorio: [Apache 2.0](LICENSE).
