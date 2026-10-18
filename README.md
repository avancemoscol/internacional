# Avancemos Internacional

Sitio aparte para la red de colombianos en el exterior. Usa el mismo proyecto Supabase de Avancemos (`zxlqwhjlgmoqemcuseek`): las cuentas del sitio principal sirven para entrar.

- `index.html`: inicio de sesión y registro (queda pendiente hasta que un coordinador apruebe).
- `app.html`: miembros. Inicio con lo pendiente, tablero (anuncios, acuerdos, actas, tareas con "marcar como leído"), votaciones y encuestas, organigrama y mapa, perfil.
- `admin.html`: coordinadores y administradores. Aprobar miembros, publicar, crear votaciones, ver quién leyó o votó y recordarles por WhatsApp, y editar el organigrama.

## Roles
- `miembro`: lee, vota y ve el organigrama.
- `coordinador`: además publica, crea votaciones, aprueba miembros y edita el organigrama.
- `admin`: además cambia roles y elimina miembros. El `admin_nacional` de Avancemos es admin aquí automáticamente.

## Base de datos
Aplicar `supabase/0017_plataforma_internacional.sql` una vez (SQL editor de Supabase). Todas las tablas usan el prefijo `int_` y tienen RLS.

Para nombrar al primer administrador internacional, después de que la persona se registre:
```sql
update public.int_miembros set rol = 'admin', estado = 'activo' where user_id = (select id from auth.users where email = 'correo@ejemplo.com');
```

Servidor local: `python3 -m http.server 3000`.
