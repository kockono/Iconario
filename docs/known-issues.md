# Estado y límites de la versión

La corrección del issue #1 pasó la revisión independiente. La suite tiene 76 pruebas correctas y el build se comprobó en una bóveda aislada de Obsidian con Make.md 1.3.5. No quedan bloqueos identificados en esa revisión; esto no garantiza la ausencia de otros errores.

## Issue #1: corregido

Las operaciones pendientes comprueban la identidad de la carpeta y de las notas físicas involucradas. Aceptan renombres del mismo archivo y rechazan archivos nuevos que sustituyan al original en la misma ruta. El borrado también limpia el ownership asociado a la nota eliminada.

Se probaron escrituras y retiradas pendientes con sustitución y con renombrado, conservando stickers, otros campos y cuerpos de las notas. Consulta `testing.md` para distinguir las pruebas automatizadas de las ejecutadas dentro de Obsidian.

## Límites vigentes

- Versión experimental; todavía no hay una release estable.
- Integración comprobada con Make.md 1.3.5 y notas de carpeta dentro de la propia carpeta, con su mismo nombre.
- Móvil y otras versiones o configuraciones de Make.md no están validados.
- Los cambios hechos directamente en el selector de Make.md no actualizan la asignación del explorador nativo; utiliza el menú de Iconario para mantener ambas vistas sincronizadas.
- Las claves especiales de diccionario se probaron en el harness. La carpeta exacta `__proto__` no pudo resolverse mediante la API de esta instancia de Obsidian.

Iconario no se instaló en la bóveda principal. Prueba esta versión primero en una bóveda de prueba.
