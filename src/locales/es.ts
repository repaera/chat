// src/locales/es.ts
export default {
	// ── AI system prompt strings ───────────────────────────────────
	system: {
		persona: (name: string) => `Eres un asistente personal de IA para ${name}.`,
		helpWithTools:
			"Ayuda al usuario usando las herramientas disponibles cuando sea relevante.",
		tone: "Responde siempre en español, de manera amigable y concisa.",
		proactiveTools:
			"Cuando el usuario solicite una acción o datos que una herramienta pueda manejar, llama a la herramienta inmediatamente sin pedir confirmación.",
		imageUrlTag:
			"Cada imagen enviada por el usuario está acompañada de una etiqueta [image_url: https://...] colocada justo antes de la imagen.",
		imageUrlUsage:
			"Esta etiqueta contiene la URL pública de la imagen — úsala si el usuario pregunta por la URL de la imagen,",
		imageUrlToolHint:
			"o inclúyela como valor photo_url/image_url en las llamadas a herramientas relevantes.",
		analyseImage:
			"Analiza el contenido de la imagen para responder las preguntas del usuario.",
		imageOutput:
			"Cuando quieras mostrar un archivo de imagen real al usuario — como una foto de producto, un recibo, una imagen generada o una URL directa de archivo de imagen (que termine en .jpg, .png, .webp, .gif, etc.) de un resultado de herramienta — usa la sintaxis estándar de markdown para imágenes:\n![descripción](URL)\nEjemplo: ![foto de producto](https://example.com/photo.jpg)\nNO uses la sintaxis de imagen para enlaces de mapas, URLs de navegación, páginas web o cualquier URL que no sea un archivo de imagen directo. Usa un enlace markdown normal [texto](URL) para esos casos.",
		currentTime: (dt: string) =>
			`La hora actual es ${dt} (solo horas y minutos). No agregues segundos ni milisegundos.`,
		timezone: (tz: string) =>
			`La zona horaria del usuario es ${tz}. Úsala para cualquier referencia de fecha/hora.`,
	},

	// ── Bot messages ───────────────────────────────────────────────
	bot: {
		linked:
			"¡Cuenta vinculada! Tus conversaciones ahora están sincronizadas con la aplicación web.\n\nEnvía /newchat para iniciar una conversación nueva.\n\nActualiza la aplicación web para ver tus conversaciones sincronizadas.",
		newchat: "Nueva conversación iniciada. ¿En qué puedo ayudarte?",
	},

	// ── UI strings ─────────────────────────────────────────────────
	ui: {
		meta: {
			description: "Tu asistente personal de IA",
			htmlLang: "es",
		},
		common: {
			save: "Guardar",
			saving: "Guardando...",
			cancel: "Cancelar",
			delete: "Eliminar",
			back: "← Atrás",
			loading: "Cargando...",
		},
		auth: {
			orWithEmail: "o con correo electrónico",
			alreadyHaveAccount: "¿Ya tienes cuenta?",
			signIn: "Iniciar sesión",
			noAccount: "¿No tienes cuenta?",
			signUp: "Registrarse",
			forgotPassword: "¿Olvidaste tu contraseña?",
		},
		register: {
			pageTitle: "Crear cuenta",
			pageSubtitle: "Comienza a chatear con tu asistente de IA",
			cardTitle: "Registro",
			cardDescription:
				"Completa los detalles a continuación para crear tu cuenta",
			googleButton: "Registrarse con Google",
			nameLabel: "Nombre completo",
			namePlaceholder: "Juan García",
			emailLabel: "Correo electrónico",
			emailPlaceholder: "tú@correo.com",
			passwordLabel: "Contraseña",
			passwordPlaceholder: "Al menos 8 caracteres",
			confirmPasswordLabel: "Confirmar contraseña",
			confirmPasswordPlaceholder: "Repite tu contraseña",
			submitButton: "Crear cuenta",
			submittingButton: "Creando cuenta...",
			termsPrefix: "Al registrarte, aceptas nuestros",
			terms: "Términos de servicio",
			termsAnd: "y",
			privacy: "Política de privacidad",
			passwordMatch: "Las contraseñas coinciden ✓",
			passwordNoMatch: "Las contraseñas no coinciden",
			passwordStrength: {
				1: { label: "Muy débil", color: "bg-red-500" },
				2: { label: "Débil", color: "bg-orange-500" },
				3: { label: "Regular", color: "bg-yellow-500" },
				4: { label: "Fuerte", color: "bg-green-500" },
			},
			errors: {
				nameRequired: "El nombre es obligatorio.",
				nameTooShort: "El nombre debe tener al menos 2 caracteres.",
				emailRequired: "El correo es obligatorio.",
				emailInvalid: "Formato de correo inválido.",
				passwordRequired: "La contraseña es obligatoria.",
				passwordTooShort: "La contraseña debe tener al menos 8 caracteres.",
				passwordTooWeak:
					"Contraseña muy débil. Agrega mayúsculas, números o símbolos.",
				confirmRequired: "Por favor confirma tu contraseña.",
				confirmMismatch: "Las contraseñas no coinciden.",
				emailTaken: "Este correo ya está registrado.",
				genericError: "Error al crear cuenta. Inténtalo de nuevo.",
				oauthError: "Error al registrarse con Google. Inténtalo de nuevo.",
			},
			success: "¡Cuenta creada! Bienvenido 🎉",
		},
		login: {
			pageTitle: "Bienvenido de nuevo",
			pageSubtitle: "Inicia sesión para continuar",
			cardTitle: "Iniciar sesión",
			cardDescription: "Ingresa tus credenciales para continuar",
			googleButton: "Iniciar sesión con Google",
			emailLabel: "Correo electrónico",
			passwordLabel: "Contraseña",
			submitButton: "Iniciar sesión",
			submittingButton: "Iniciando sesión...",
			errors: {
				emailRequired: "El correo es obligatorio.",
				passwordRequired: "La contraseña es obligatoria.",
				invalidCredentials: "Correo o contraseña incorrectos.",
				genericError: "Ocurrió un error. Inténtalo de nuevo.",
				oauthError: "Error al iniciar sesión con Google. Inténtalo de nuevo.",
				rateLimited: "Demasiados intentos. Por favor espera unos minutos.",
				sessionExpired:
					"Tu sesión ha expirado. Por favor inicia sesión de nuevo.",
				emailNotVerified:
					"Tu correo no está verificado. Revisa tu bandeja de entrada.",
			},
		},
		settings: {
			pageTitle: "Configuración",
			backLink: "Atrás",
			retentionNotice:
				"Las conversaciones inactivas por más de {days} días se eliminarán automáticamente junto con todos los mensajes e imágenes adjuntas.",
			tabProfile: "Perfil",
			tabSecurity: "Seguridad",
			tabAccount: "Cuenta",
			tabLinks: "Vínculos",
			profileCard: {
				title: "Información del perfil",
				description: "Actualiza tu nombre de usuario.",
				nameLabel: "Nombre",
				emailLabel: "Correo",
				localeLabel: "Idioma",
				localeAuto: "Auto (desde ubicación)",
				localeHint:
					"Determina el idioma de respuesta de la IA. Vacío = usar detección automática.",
				saveNameButton: "Guardar nombre",
				changeEmailButton: "Cambiar correo",
				changingEmail: "Enviando...",
				emailSent: "Enlace de verificación enviado — revisa tu nuevo correo.",
				localeOptions: {
					en: "English",
					id: "Bahasa Indonesia",
					kr: "한국어 (Korean)",
					jp: "日本語 (Japanese)",
					es: "Español (Spanish)",
					zh: "中文 (Mandarin)",
					de: "Deutsch (German)",
					nl: "Nederlands (Dutch)",
					fr: "Français (French)",
					it: "Italiano (Italian)",
				},
			},
			securityCard: {
				title: "Cambiar contraseña",
				description: "Usa una contraseña fuerte y única.",
				currentPasswordLabel: "Contraseña actual",
				newPasswordLabel: "Nueva contraseña",
				submitButton: "Cambiar contraseña",
				submittingButton: "Guardando...",
				errors: {
					tooShort: "La nueva contraseña debe tener al menos 8 caracteres.",
					wrongPassword: "La contraseña actual es incorrecta.",
					genericError: "Error al cambiar la contraseña.",
				},
				success: "Contraseña cambiada exitosamente.",
			},
			dangerCard: {
				title: "Eliminar cuenta",
				description:
					"Esta acción es permanente y no se puede deshacer. Todas las conversaciones serán eliminadas.",
				deleteButton: "Eliminar mi cuenta",
				confirmTitle: "¿Estás seguro?",
				confirmDescription:
					"Todos los datos, incluidas las conversaciones, serán eliminados permanentemente. Esto no se puede deshacer.",
				confirmCancel: "Cancelar",
				confirmDelete: "Sí, eliminar cuenta",
				error: "Error al eliminar la cuenta.",
			},
			toasts: {
				profileSaved: "Perfil guardado.",
				profileError: "Error al guardar el perfil.",
				localeError: "Error al guardar el idioma.",
			},
			linksCard: {
				title: "Cuentas vinculadas",
				description:
					"Conecta tus cuentas de mensajería para chatear con tu asistente de IA en otras plataformas.",
				notLinked: "No vinculado",
				linkedAs: "Vinculado como",
				generateCode: "Generar código",
				copyCode: "Copiar",
				unlink: "Desvincular",
				unlinkConfirmTitle: "¿Desvincular cuenta?",
				unlinkConfirmDescription:
					"Tu historial de conversaciones se conservará pero se eliminará el vínculo de la cuenta.",
				unlinkConfirmCancel: "Cancelar",
				unlinkConfirmDelete: "Desvincular",
				codeExpiry: "Caduca en 15 minutos",
				codeExpired: "Código caducado",
				refreshHint:
					"Después de vincular, actualiza esta página para ver tus conversaciones sincronizadas.",
				instruction: "Envía este comando al bot:",
				platforms: {
					telegram: "Telegram",
					whatsapp: "WhatsApp",
					slack: "Slack",
					teams: "Microsoft Teams",
					gchat: "Google Chat",
					discord: "Discord",
					github: "GitHub",
					linear: "Linear",
				},
				toasts: {
					generated: "Código generado.",
					copied: "Código copiado.",
					unlinked: "Cuenta desvinculada.",
					error: "Algo salió mal. Inténtalo de nuevo.",
				},
			},
		},
		chatLayout: {
			newButton: "Nuevo chat",
			emptyState: "Aún no hay conversaciones.",
			untitledConversation: "Nueva conversación",
			settings: "Configuración",
			signOut: "Cerrar sesión",
			deleteDialog: {
				title: "¿Eliminar conversación?",
				description: "Esta conversación será eliminada permanentemente.",
				cancel: "Cancelar",
				confirm: "Eliminar",
			},
			toasts: {
				deleteFailed: "Error al eliminar la conversación.",
				deleteSuccess: "Conversación eliminada.",
			},
		},
		chatClient: {
			newConversationTitle: "Nueva conversación",
			loadingMore: "Cargando mensajes anteriores...",
			emptyHint: "Pregúntame lo que quieras.",
			suggestions: [
				"¿Con qué puedes ayudarme?",
				"¿Qué herramientas tienes?",
				"Cuéntame algo interesante",
			],
			toolCalling: "Llamando",
			toolDone: "Listo:",
			locationLabel: "Ubicación",
			locationDialog: {
				shareLocationBtn: "Compartir ubicación",
				commuteBtn: "Trayecto",
				dialogTitle: "Compartir ubicación",
				dialogClose: "Cerrar",
				searchPlaceholder: "Buscar lugar o dirección...",
				originPlaceholder: "Desde — dirección de origen",
				destinationPlaceholder: "Hasta — dirección de destino",
				confirmBtn: "Confirmar",
				searchingLabel: "Buscando...",
				noResults: "No se encontraron resultados.",
				distanceLabel: "Distancia",
				durationLabel: "Duración estimada",
				calculating: "Calculando ruta...",
				calcFailed: "Error al calcular la ruta. Inténtalo de nuevo.",
			},
			locationPrefix: "📍 Mi ubicación:",
			inputPlaceholder: "Escribe un mensaje..",
			toasts: {
				imageExpired: "Imagen expirada — sube de nuevo.",
				geolocationUnsupported: "Tu navegador no admite geolocalización.",
				geolocationFailed:
					"Error al obtener la ubicación. Asegúrate de tener el permiso habilitado.",
				weeklyLimitReached:
					"Has alcanzado tu límite de mensajes semanales. Inténtalo la próxima semana.",
			},
			quotaWarning: "Te quedan {n} mensajes esta semana.",
		},
		imageUpload: {
			uploading: "Subiendo..",
			menuLabel: "Imagen",
			ariaLabel: "Adjuntar imagen",
			tooltip: "Adjuntar imagen (máx. 10MB)",
			errors: {
				unsupportedFormat: "Formato no compatible. Usa JPG, PNG, GIF o WebP.",
				fileTooLarge: "El archivo supera los {mb}MB.",
				notConfigured: "La carga de imágenes no está configurada.",
				uploadFailed: "Error al subir la imagen.",
				uploadFailedRetry: "Error al subir la imagen. Inténtalo de nuevo.",
			},
			imageCrop: {
				title: "Editar imagen",
				apply: "Aplicar",
				cancel: "Cancelar",
			},
		},
		forgotPassword: {
			pageTitle: "Olvidé mi contraseña",
			pageSubtitleDefault:
				"Ingresa tu correo y te enviaremos un enlace de restablecimiento.",
			pageSubtitleSent:
				"Si tu correo está registrado, se ha enviado un enlace de restablecimiento.",
			cardTitle: "Restablecer contraseña",
			cardDescriptionDefault: "El enlace es válido por 1 hora.",
			cardDescriptionSent: "Revisa tu bandeja de entrada y carpeta de spam.",
			emailLabel: "Correo electrónico",
			submitButton: "Enviar enlace",
			submittingButton: "Enviando...",
			sentTo: "Enlace enviado a",
			sendToAnother: "Enviar a otro correo",
			backToLogin: "← Volver al inicio de sesión",
			errors: {
				emailRequired: "El correo es obligatorio.",
				emailInvalid: "Formato de correo inválido.",
				genericError: "Error al enviar el correo. Inténtalo de nuevo.",
			},
		},
		resetPassword: {
			pageTitle: "Restablecer contraseña",
			pageDescription: "Ingresa tu nueva contraseña.",
			newPasswordLabel: "Nueva contraseña",
			newPasswordPlaceholder: "Al menos 8 caracteres",
			confirmPasswordLabel: "Confirmar contraseña",
			confirmPasswordPlaceholder: "Repite la nueva contraseña",
			submitButton: "Guardar nueva contraseña",
			submittingButton: "Guardando...",
			loadingFallback: "Cargando...",
			invalidToken: "Enlace inválido. Solicita uno nuevo desde la",
			invalidTokenLink: "página de olvidé mi contraseña",
			errors: {
				mismatch: "Las contraseñas no coinciden.",
				tooShort: "La contraseña debe tener al menos 8 caracteres.",
				invalidLink: "El enlace de restablecimiento es inválido o ha expirado.",
			},
			success: "Contraseña restablecida exitosamente.",
		},
		verifyEmail: {
			title: "Revisa tu correo",
			description:
				"Enviamos un enlace de verificación a tu correo. Haz clic en él para activar tu cuenta.",
			noEmail: "¿No lo recibiste? Revisa tu carpeta de spam o",
			resend: "solicita uno nuevo",
			backToLogin: "Volver al inicio de sesión",
		},
		error: {
			title: "Algo salió mal",
			description:
				"Ocurrió un error inesperado. Nuestro equipo ha sido notificado.",
			retry: "Intentar de nuevo",
		},
		notFound: {
			title: "Página no encontrada",
			description: "La página que buscas no existe o ha sido eliminada.",
			backToChat: "Volver al chat",
		},
	},
};
