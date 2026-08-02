# Proyecto: Pipeline serverless de media en AWS (Level 06 del portafolio) — Guía para el agente

Esta guía es autocontenida. Trabajarás en un **repo nuevo**, separado del sitio del portafolio.

## Contexto

Jesus Bordones ("Chu") tiene un portafolio arcade en www.jabordones.com donde los proyectos son "Levels". Su Loadout declara la disciplina **Cloud/AWS**, pero es la claim más difícil de *mostrar*: no se puede embeber "una arquitectura" en una página. Este proyecto la hace tangible: el visitante **usa** infraestructura AWS real y la ve responder en segundos.

Será el **Level 06** del sitio, con un case study que embebe la herramienta viva más un diagrama de la arquitectura.

## Objetivo

Al terminar deben existir:
1. Una herramienta web pública: arrastras una imagen, recibes variantes **WebP/AVIF optimizadas en varios tamaños** con comparación de peso antes/después y descarga.
2. Toda la infraestructura desplegada en AWS **como código (IaC con AWS CDK)** — el repo de infra es parte de la prueba, no un extra.
3. Repo público en GitHub bajo **Chu13** (app + infra en el mismo repo, monorepo simple).

## Especificación funcional

1. **Upload directo a S3 con presigned URL** — el archivo nunca pasa por un servidor propio. El frontend pide la presigned URL a una API mínima (API Gateway + Lambda o Lambda function URL), valida tipo/tamaño, y sube directo.
2. **Procesamiento en Lambda con sharp**: al llegar el objeto (trigger S3), genera variantes WebP y AVIF en ~3 tamaños (p. ej. 480/1024/1920 de ancho), preservando aspect ratio.
3. **Entrega vía CloudFront** sobre el bucket de salida.
4. **UI de resultados:** por cada variante, peso original vs. optimizado, porcentaje de ahorro y link de descarga. Estado del pipeline visible (subiendo → procesando → listo) con polling o similar — el visitante debe *ver* que hay un pipeline trabajando.
5. **Autodestrucción visible:** los archivos expiran automáticamente en 1 hora (S3 lifecycle en ambos buckets) y la UI lo dice en un lugar visible: "los archivos se autodestruyen en 60 min". Ese mensaje es en sí una señal de criterio.

## Stack

- **Infra:** AWS CDK (TypeScript). Recursos: 2 buckets S3 (in/out, con lifecycle 1h), Lambda de presign, Lambda de procesamiento (sharp como layer o bundle), CloudFront, y lo mínimo de IAM con permisos acotados por recurso.
- **Frontend:** app web mínima y pulida (Next.js o Vite estático) desplegada donde sea más simple (Vercel o el mismo CloudFront). Drag-and-drop, mobile-friendly.
- **Tests:** unit tests de la lógica de la Lambda de procesamiento (dimensiones, formatos, nombres de salida) con Vitest/Jest.

## Requisitos no funcionales

- **Límites anti-abuso estrictos:** máx. ~10 MB por archivo, solo image/jpeg|png|webp (validado en presign y en la Lambda), rate limit por IP en la API de presign, presigned URLs de vida corta (≤5 min).
- **Costos bajo control:** todo dentro del free tier de AWS a tráfico de portafolio; sin recursos always-on. Documentar el costo estimado en el README — hablar de costos con números es parte del showcase.
- **Sin datos personales:** no se guarda nada del usuario; los objetos expiran solos. Decirlo en la UI.
- **Accesibilidad:** el drag-and-drop tiene alternativa de file picker; estados anunciados con `aria-live`.

## Contrato con el sitio del portafolio (Chu-Website)

El sitio renderiza cada proyecto desde un objeto `Project` en `src/data/projects.ts` y embebe la demo en un **iframe sandboxeado**. Al terminar, entrega:

1. **`demoUrl`** — URL pública de la herramienta. **Requisito crítico: embebible en iframe** — sin `X-Frame-Options` ni `frame-ancestors` que bloqueen a www.jabordones.com.
2. **`githubUrl`** — repo público. El README debe incluir el **diagrama de arquitectura** (S3 → Lambda → S3 → CloudFront) exportado también como SVG/PNG limpio: el sitio lo re-renderizará en su propio estilo visual (flat, sin sombras) para el case study.
3. **Cover 16:9** — screenshot PNG real de la herramienta con un resultado en pantalla (~1600×900) + alt text descriptivo.
4. **5 highlights honestos** — p. ej.: upload directo con presigned URLs (el archivo nunca toca un servidor propio); pipeline event-driven S3→Lambda; IaC completa con CDK; expiración automática de 1h como decisión de diseño; IAM de mínimo privilegio.
5. **Un párrafo "problem"** (por qué existe: optimizar imágenes es una tarea real y universal; la mayoría de las herramientas online suben tus archivos a servidores opacos sin decirte qué pasa con ellos) **y un párrafo "architectureNote"** (cómo las piezas forman un sistema y por qué serverless es la forma correcta para una carga esporádica).
6. Una entrada para el `/log` del sitio anunciando el nivel.

## Criterios de aceptación

- [ ] Subir un JPEG de 5 MB devuelve variantes WebP y AVIF en 3 tamaños con ahorro visible, en segundos.
- [ ] Archivos >10 MB o de tipo no permitido se rechazan en presign **y** en la Lambda.
- [ ] Los objetos desaparecen de ambos buckets tras 1h (lifecycle verificado).
- [ ] `cdk deploy` desde cero levanta toda la infra sin pasos manuales; `cdk destroy` la elimina limpia.
- [ ] La herramienta es embebible en iframe desde otro dominio.
- [ ] README con diagrama, decisiones y costos estimados; tests de la Lambda pasan.
