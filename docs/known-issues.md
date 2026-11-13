# Fallos pendientes

La revisión independiente final no aprobó esta versión. Las 43 pruebas automatizadas pasan, pero no cubren las dos carreras siguientes, reproducidas por el revisor con callbacks de frontmatter diferidos.

## Reasignar mientras se retira un icono

Una retirada pendiente conserva una referencia al registro anterior. Si otro cambio modifica el sticker y se asigna un icono nuevo antes de terminar la retirada, esta puede borrar el registro nuevo. El sticker queda sin el historial necesario para recuperar el valor externo anterior.

La corrección debe distinguir la operación que se está retirando del registro que la haya reemplazado y conservar el baseline vigente.

## Renombrar mientras se retira un icono

Si se renombra una nota durante una retirada pendiente, el listener mueve el registro a la nueva ruta, pero la retirada sigue utilizando la anterior. Puede desaparecer la asignación local sin restaurarse el sticker, dejando un registro huérfano en la nueva ruta.

La corrección debe seguir la identidad de la asignación a través del renombrado, también durante restauraciones pendientes.

## Estado de la entrega

El código y el ZIP experimental están en el proyecto, pero no deben instalarse en una bóveda de trabajo. La instancia de pruebas se cerró; no se instaló Iconario en la bóveda principal. Los cuatro archivos protegidos comprobados conservan sus hashes iniciales.

Se completaron dos rondas automáticas de corrección y revisión. La siguiente ronda requiere decisión del usuario. Antes de entregar habrá que añadir regresiones para estos casos, aplicar una corrección coherente del ciclo de vida de las operaciones, repetir la revisión independiente y regenerar el paquete.
