# Iconario

> Versión experimental 0.1.0. Las correcciones de conservación de stickers pasaron la revisión independiente y las pruebas descritas en `docs/testing.md`. Pruébala primero en una bóveda de prueba; todavía no hay una release estable.

Plugin de Obsidian para insertar iconos de Font Awesome Free y Remix Icon en notas y asignarlos a archivos o carpetas. El catálogo se incluye localmente: el plugin no descarga SVG ni envía telemetría.

## Instalación de prueba

Genera el paquete desde el código con `npm ci` y `npm run package`. Descomprime `dist/iconario-0.1.0.zip` en `.obsidian/plugins/` de un **vault de prueba**. Deben quedar `iconario/manifest.json`, `iconario/main.js` y `iconario/styles.css`. Activa Iconario desde los ajustes de plugins de Obsidian. No se ha instalado ni activado en el vault principal.

## Uso

- Ejecuta **Iconario: Insertar icono en la nota activa**. El selector permite buscar, filtrar, navegar con flechas y Enter, guardar favoritos y ver recientes. Elige color y tamaño para la vista previa.
- El texto insertado tiene forma `:iconario[fa-solid/house]:`. Sigue siendo Markdown legible cuando el plugin está desactivado. En lectura y Live Preview se representa como SVG local, salvo dentro de código o si el identificador no existe.
- Usa **Asignar icono con Iconario** en el menú contextual de un archivo o carpeta para mostrarlo en el explorador nativo y en Make.md. Iconario guarda la asignación sin renombrar archivos; si activas la sincronización con Make.md, también actualiza el frontmatter como se explica abajo. Puedes desactivar los iconos del explorador nativo en ajustes.
- El catálogo contiene 5298 iconos: Font Awesome Free Solid, Regular y Brands, y Remix Icon. No incluye las colecciones de pago.

## Make.md 1.3.5

Iconario comprueba la versión y la estructura interna de Make.md 1.3.5 antes de registrar cuatro packs en su `AssetManager`. Los stickers tienen identificadores como `iconario-fa-solid//house`. El selector de Make.md toma una instantánea al abrirse: ciérralo y ábrelo de nuevo después de cargar Iconario. El registro es temporal; al desactivar Iconario se retiran solo los assets y entradas de caché que siguen siendo propios. Los stickers guardados pueden quedar vacíos mientras Iconario no esté activo.

Si la sincronización está activada, asignar un icono a una nota Markdown escribe la propiedad de frontmatter configurada (`sticker` por defecto). Para carpetas se usa la nota de carpeta según `folderNoteName` de Make.md; si falta, Iconario pide confirmación antes de crearla. Al quitar la asignación, restaura el valor anterior solo si el valor actual todavía es el que escribió Iconario. Otros campos y el cuerpo de la nota se conservan. La integración usa una API interna de Make.md y se desactiva de forma segura si la versión o estructura no coincide.

Para mantener las dos vistas con el mismo icono, utiliza el menú de Iconario. Los cambios hechos directamente en el selector de Make.md no actualizan la asignación del explorador nativo. Antes de desinstalar Iconario, utiliza **Quitar icono de Iconario** si quieres recuperar los stickers anteriores.

## Desarrollo y verificación

Con Node y npm instalados: `npm ci`, `npm test`, `npm run typecheck`, `npm run build`, `npm run package`. El generador usa las versiones exactas del lockfile y produce `src/generated/icons.ts`. Consulta `docs/testing.md` para los resultados observados.

Se comprobó el plugin en una bóveda aislada de Obsidian con Make.md 1.3.5: lectura, Live Preview, modo fuente, inserción desde el selector y asignaciones de archivos y carpetas. La integración de carpetas se probó con la nota dentro de la propia carpeta y el mismo nombre que esta. No se ha validado en móvil ni con otras versiones o configuraciones de Make.md.

## Licencias

El código original está bajo MIT (`LICENSE`). El catálogo incluye Font Awesome Free 7.3.1 (SVG bajo CC BY 4.0) y Remix Icon 4.7.0, cuyo archivo `License` instalado contiene Apache-2.0. `THIRD_PARTY_NOTICES` conserva los textos completos de las licencias de esos paquetes, sus atribuciones y las normalizaciones aplicadas a los SVG. Las versiones están fijadas en `package.json` y `package-lock.json`; el ZIP incluye esas atribuciones.
