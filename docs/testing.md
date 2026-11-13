# Pruebas de Iconario

Se utilizó Node/npm en `C:/nvm4w/nodejs` mediante PATH local. La primera tabla recoge pruebas automatizadas durante el desarrollo. La validación dentro de Obsidian se describe en su propia sección.

| Corte | RED observado | GREEN observado |
| --- | --- | --- |
| Catálogo | `npm test -- src/catalog.test.ts`: módulo `./catalog` ausente, salida 1 | mismo comando: 2/2 tests, salida 0 |
| Tokens Markdown | `npm exec -- vitest run src/markdown.test.ts`: módulo `./markdown` ausente, salida 1 | mismo comando: 3/3 tests, salida 0 |
| Asignaciones y explorador | `npm test -- src/assignments.test.ts src/explorer.test.ts`: módulos ausentes, salida 1 | mismo comando: 5/5 tests, salida 0 |
| Make.md | `npm test -- --run src/makemd.test.ts`: módulo `./makemd` ausente, salida 1 | mismo comando: 5/5 tests, salida 0 |
| Selector | `npm test -- --run src/picker.test.ts`: módulo `./picker` ausente, salida 1 | mismo comando: 3/3 tests, salida 0 |
| Apariencia guardada | `npm test -- --run src/picker.test.ts`: tamaño esperado `32`, recibido `20`, salida 1 | mismo comando: 4/4 tests, salida 0 |
| Namespace SVG del catálogo real | `node node_modules/vitest/vitest.mjs run src/catalog.test.ts src/catalog-rendering.integration.test.ts`: 6 fallos y 1 prueba correcta; cuatro SVG rechazados como `null`, namespace ausente y catálogo anterior de 5392 registros | `npm test -- src/catalog.test.ts src/catalog-rendering.integration.test.ts` tras regenerar: 2 archivos y 7/7 pruebas, salida 0 |

## Catálogo y licencias verificadas

`npm run generate` produjo 5298 registros: 1422 de `fa-solid`, 169 de `fa-regular`, 572 de `fa-brands` y 3135 de Remix Icon 4.7.0. La prueba del catálogo comprueba el namespace SVG canónico en todos los registros; la prueba de integración usa el catálogo real para representar cuatro iconos, uno por colección, mediante el saneador de Markdown sin modificarlo.

Dos ejecuciones consecutivas del generador dieron el mismo SHA-256: `109e5b9b14294f25bd57d1b066097a45896fcd20b777e0cf0a249beb0d611c69`.

Se comprobó que la dependencia instalada y el lockfile indican Remix Icon 4.7.0. `THIRD_PARTY_NOTICES` contiene íntegros los textos de `node_modules/remixicon/License` (Apache-2.0) y `LICENSE.txt` de Font Awesome Free 7.3.1 (idéntico en los tres paquetes). El copyright de Remix se tomó del encabezado incluido: `Copyright RemixIcon.com`.

El primer intento de regeneración detectó dos SVG de Remix 4.7.0 con `fill` hexadecimal en el path (`remix-run-fill` y `webhook-line`). El generador acepta únicamente ese atributo literal opcional y lo elimina al reconstruir los paths para heredar `currentColor`; continúa rechazando contenido no reconocido.

## Verificación conjunta

**Revisión independiente aprobada.** La corrección del issue #1 verifica la identidad de las notas físicas en callbacks y al completar operaciones: un renombrado del mismo archivo sigue siendo válido, pero una nota sustituta en la misma ruta no recibe datos del archivo eliminado.

La suite conjunta pasó **76 pruebas en 8 archivos**. Para el issue #1 se observaron primero seis fallos y dos controles de renombre correctos; después de la corrección, los ocho casos pasaron. Se mantienen las regresiones de reasignación, ownership compartido, cambio de destino, claves especiales y borrado durante guardados. La revisión independiente también comprobó seis interleavings de sustitución y renombre de destinos físicos sin reproducir pérdidas de baselines. `npm run typecheck` y `npm run package` terminaron con salida 0. La suite incluye regresiones para código Markdown, modo fuente, propiedad compartida del frontmatter, renombrados y descarga de los assets de Make.md. El cierre de la confirmación de crear una nota también se comprobó para evitar operaciones pendientes.

## Comprobaciones dentro de Obsidian

La validación real utilizó un perfil y una bóveda independientes en `.qa/`, con Make.md 1.3.5. Iconario no se instaló en la bóveda principal.

- Dos tokens se representan en lectura y Live Preview; los ejemplos dentro de código permanecen literales. El modo fuente no contiene widgets de Iconario y conserva el texto.
- El comando de inserción abre el selector, encuentra `remix/lightbulb-line`, guarda el token y muestra el icono en Live Preview.
- El selector permite filtrar y seleccionar con Enter. Los SVG de los resultados no quedan recortados.
- Una carpeta y una nota muestran sus iconos en el explorador nativo y en Make.md.
- Los cuatro packs aparecen en el selector de Make.md. La búsqueda de `lightbulb-line` dentro de Remix encuentra el icono.
- Las asignaciones compartidas de carpeta y nota recuperan el sticker original en ambos órdenes de retirada. Se conservan el cuerpo y otra propiedad de frontmatter.
- Al renombrar únicamente la nota de carpeta, quitar la asignación de la carpeta restaura el sticker en la nueva ruta.
- Si otra operación cambia el sticker, quitar la asignación no sobrescribe ese cambio.
- Cerrar con X la confirmación de crear una nota no crea la nota ni deja una promesa pendiente.
- Al descargar Iconario se retiran sus packs y entradas de caché de Make.md.
- En el build con la corrección del issue #1 se probaron cuatro casos: escritura y retirada pendientes, cada una con sustitución de la nota o renombrado del mismo archivo. Los cuatro terminaron sin errores; las notas sustitutas conservaron sticker, título y cuerpo, y los renombres siguieron funcionando.

Las claves `__proto__`, `constructor` y `hasOwnProperty` se cubrieron en pruebas automatizadas de persistencia y renombre. La carpeta exacta `__proto__` no pudo validarse en la aplicación: esta instancia de Obsidian no la resolvió mediante su API de búsqueda. No se presenta esa parte del harness como prueba visual o de integración real.

Los scripts y las capturas están en `.qa/`; no forman parte del ZIP instalable.

## Límites y empaquetado

La configuración probada de Make.md utiliza notas dentro de su carpeta y con el mismo nombre que esta. No se ha comprobado móvil, otras versiones de Make.md ni todas sus configuraciones de notas de carpeta. Para mantener las dos vistas sincronizadas, la asignación debe hacerse desde Iconario; editar un sticker directamente en Make.md no actualiza la asignación nativa.

`THIRD_PARTY_NOTICES` incluye también las licencias de los módulos Lezer incorporados en el bundle. El ZIP contiene seis archivos dentro de `iconario/`: `manifest.json`, `main.js`, `styles.css`, `README.md`, `LICENSE` y `THIRD_PARTY_NOTICES`. Debe regenerarse después de cualquier cambio y compararse con los archivos fuente; no incluye `node_modules`.
