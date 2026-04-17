# AudioFit - Audiometria Web Basica

Aplicacion web de una sola pagina para realizar una prueba tonal casera con frecuencias fijas y registrar umbrales relativos por oido.

## Aviso importante

Esta herramienta **no es un dispositivo medico** ni sustituye una audiometria profesional.

- Usa auriculares bien sellados (over-ear o in-ear).
- Empieza siempre con volumen bajo.
- Realiza la prueba en un entorno silencioso.
- Deten la prueba si notas molestia.

## Funcionalidades

- Frecuencias de prueba: `250`, `500`, `1000`, `2000`, `4000`, `8000` Hz.
- Seleccion de oido izquierdo/derecho con paneo estereo.
- Generacion de tonos puros con Web Audio API (`OscillatorNode` + `GainNode`).
- Fade-in y fade-out de `0.1s` para evitar clics.
- Modo `Manual`: ajustas slider y registras umbral con boton.
- Modo `Auto`: el nivel sube automaticamente mientras mantienes pulsado; al soltar se guarda el umbral.
- Tabla final de resultados y boton para copiar datos.

## Uso rapido

1. Abre `index.html` en tu navegador.
2. Selecciona oido y frecuencia.
3. Elige modo:
   - `Manual`: ajusta nivel y pulsa **Registrar umbral**.
   - `Auto`: manten pulsado el tono y suelta cuando empieces a oirlo.
4. Repite para todas las frecuencias y ambos oidos.
5. Copia los resultados desde la tabla final.

## Calibracion recomendada

Como cada auricular y dispositivo suena distinto, prueba primero con una persona de audicion considerada normal para establecer una referencia interna del sistema.

## Archivos del proyecto

- `index.html`: app completa (UI + logica de audio + registro de resultados).
- `PromptInicial.txt`: prompt base del proyecto.
