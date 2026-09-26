# Trucardo: diseño

Anotador de truco (uruguayo y argentino) que escucha los cantos de la mesa y suma los
palitos solo. Pensado para dejar el celular en la mesa durante toda la partida.

## Decisiones

| Tema | Decisión | Por qué |
| --- | --- | --- |
| Plataforma | PWA (web instalable) con Vite + React + TypeScript | Corre en cualquier celular sin tienda de apps, se instala en la pantalla de inicio y se actualiza sola. |
| Voz | Web Speech API (`SpeechRecognition`) en `es-AR` | Viene en Chrome (Android) y Safari (iPhone), gratis y sin claves. Necesita internet y HTTPS. |
| Estado | Lista de jugadas + reducer puro (event sourcing) | "Deshacer" es sacar la última jugada y recalcular. Nunca se pierde un punto por un error de voz. |
| Persistencia | `localStorage` | La partida sobrevive a cerrar la app o que se apague la pantalla. |
| Confirmación | Voz del sistema (solo puntos, por defecto) + aviso con "Deshacer" | En la mesa nadie mira la pantalla: la app dice "dos para Ellos. Nosotros 12, Ellos 9". |
| Pantalla | Wake Lock | La pantalla no se apaga mientras se juega. |

## Arquitectura

```
src/game/        reglas puras, sin UI (testeadas)
  engine.ts      applyAction(estado, jugada) → nuevo estado + historial
  rules.ts       valores de envido, flor, falta, truco
  describe.ts    textos para el panel de la mano
src/voice/
  parser.ts      frase → intenciones ("truco nosotros" → canto de truco, equipo 0)
  interpret.ts   intención + estado → jugada (deduce quién canta, respuestas, etc.)
  recognizer.ts  escucha continua con reinicio automático y anti-eco
  speak.ts       confirmaciones habladas
src/app/         store (partida + preferencias) y controlador voz → reglas → aviso
src/components/  tablero de palitos, panel de la mano, micrófono, hojas
src/screens/     inicio, nueva partida, mesa
```

El motor no sabe nada de voz: la voz y los botones producen las mismas intenciones.

## Reglas implementadas

- **Truco**: truco 2 (no querido 1), retruco 3 (2), vale cuatro 4 (3). Mano sin cantos 1.
  Solo sube quien tiene el quiero. "Quiero retruco" quiere y sube en una frase.
- **Envido**: envido 2, real 3, falta envido. No querido: 1 si fue un solo canto, si no lo
  ya querido (envido-envido-real no querido = 4). "El envido está primero" con truco cantado.
  El envido se anota antes que el truco: si alcanza para ganar, gana.
- **Falta envido / contraflor al resto** (configurable): lo que le falta al que va ganando;
  en malas gana el partido (default argentino); o por tramo.
- **Flor**: 3 por flor (varias flores del mismo equipo suman). La flor anula el envido.
  Flor contra flor 4 (configurable 3/4/6), "con flor me achico" 4, con flor envido 5,
  contraflor 6, contraflor al resto = la falta. No querida: el valor anterior.
- **Mazo**: da lo que vale el truco (o lo no querido). Opcional: en primera sin envido, +1.
- **Partida**: 15, 18, 24, 30, 40 u otro; malas y buenas con raya a la mitad.

Las reglas de flor varían mucho por mesa; los valores están en `src/game/rules.ts`.

## Gramática de voz

- Cantos: truco, retruco, vale cuatro, envido, real envido, falta envido, flor,
  contraflor, contraflor al resto, con flor envido, con flor quiero, con flor me achico.
- Equipo: el nombre configurado, o "nosotros"/"ellos" (siempre primer/segundo equipo).
  Antes o después del canto. Tolera un error de reconocimiento en nombres de 5+ letras.
- Respuestas: quiero, no quiero, al mazo (+ "en primera").
- Resultados: "envido para X", "ganamos el envido", "flor para X", "mano para X",
  "truco para X", "ganaron", "punto para X". Con "para", "ganó", "es de" es resultado;
  sin eso es canto.
- Correcciones: deshacer / me equivoqué, "sumale dos a X", "restale uno a X", revancha.
- Se ignora la charla: "tengo 33", "son buenas", "¿quieren?", "ellos son mano".
- Si falta el equipo y no se puede deducir, la app pregunta ("¿Quién cantó truco?") y
  alcanza con decir el nombre.

## Límites conocidos

- El reconocimiento de voz del navegador necesita internet y HTTPS.
- No distingue quién habla: por eso los cantos llevan el nombre del equipo.
- En iPhone conviene usarla desde Safari; instalada en la pantalla de inicio, iOS puede
  no habilitar el micrófono para reconocimiento de voz.
