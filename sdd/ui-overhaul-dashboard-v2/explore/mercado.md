# Análisis de Mercado — vorTest

**Fecha**: 2026-09-16
**Skill(s) aplicada(s)**: obviously-awesome
**Paso**: 1.1

## Resumen ejecutivo

vorTest opera en la intersección de tres categorías de mercado: test automation management, QA evidence management, y audit-ready reporting. La categoría más precisa es **"QA Evidence Management Platform"** — un subsegmento de test automation que combina ejecución de tests, almacenamiento de evidencia auditable, y generación de reportes合规 (actas). El mercado global de test automation tools supera los $5B USD con crecimiento del 15% CAGR, pero el subsegmento de evidence management está menos saturado y tiene barreras de entrada más altas (integración Playwright nativa, hashes SHA-256, RBAC jerárquico).

Los competidores directos son pocas herramientas especializadas; la mayoría del mercado usa soluciones caseras (scripts + Google Drive + PDFs). Esto es significativo: **el mayor competidor de vorTest es "doing nothing structured"**, seguido por hojas de cálculo compartidas y repositorios de scripts. La oportunidad de positioning es clara: ser la solución que convierte chaos de scripts en un sistema auditável.

## Categoría de Mercado

vorTest no compite directamente con TestRail o Xray en gestión manual de casos de prueba. Esos son herramientas de **test case management** donde los humanos registran qué probar. vorTest compite en **test execution + evidence** donde Playwright ejecuta y genera artefactos. La categoría más precisa para positioning:

> **"Playwright-native Test Evidence Platform"**

Esto diferencia a vorTest de:
- TestRail/Xray/Zephyr: gestión manual, no ejecución automática
- ReportPortal: solo logs y agregación, no genera actas PDF/videos
- Jenkins + Allure: pipeline de CI, no scoped por Espacio/Proyecto con RBAC
- Datadog/Grafana: observabilidad general, no evidencia de tests funcionales

## Atributos Únicos de vorTest (según obviously-awesome, paso 2)

1. **Integración Playwright first-party**: no es una capa sobre un runner genérico — nasce con Playwright
2. **Evidence inmutable con hashes SHA-256**: cada ejecución produce PDF + video + screenshots + traces, todo hasheado
3. **Recorder integrado (Codegen)**: grabador visual de casos que exporta directamente a scripts Playwright
4. **Jerarquía Espacio → Proyecto → CasoPrueba → Ejecución → Acta**: scoping visual y RBAC de 3 niveles
5. **Proceso worker separado (scripts/worker.ts)**: ejecución desacoplada del frontend, escalabilidad real
6. **WebSocket para feedback en vivo**: el tester ve progreso en tiempo real durante la ejecución

## Análisis Competitivo

| Herramienta | Ejecución | Evidence | RBAC | Recorder | Acta PDF |
|-------------|-----------|----------|------|----------|----------|
| ReportPortal | Logs agregados | Screenshots | Basic | No | No |
| TestRail | Manual | Adjuntos | Projects | No | No |
| Xray (Jira) | Integraciones CI | Adjuntos | Jira-based | No | No |
| Jenkins + Allure | CI/CD | Reports HTML | Basic | No | No |
| qTest | Manual + CI | Adjuntos | Hierarchical | No | No |
| **vorTest** | **Playwright native** | **SHA-256 + video** | **Espacio/Proyecto** | **Sí (Codegen)** | **Sí (1:1)** |

## Positioning Statement (paso 5 de obviously-awesome)

> **Para equipos de QA que necesitan evidencia auditable de pruebas automatizadas**, vorTest es la **plataforma de evidencia Playwright** que **genera actas inmutables con video y hashes SHA-256**, a diferencia de ReportPortal que solo agrega logs, y de spreadsheets que no ofrecen trazabilidad.

## Relevant Trends

- **AI/ML en testing**: Playwright tiene AI-assisted locators; vorTest puede capitalizar en integrar estas capacidades
- **Regulatory compliance**: industrias reguladas (fintech, health-tech) requieren evidencia de testing; actas PDF con hashes tienen valor legal
- **Shift-left testing**: más equipos hacen automatización antes en el pipeline; vorTest facilita que testers no-dev escriban tests con el recorder

## Implicaciones para el rediseño UI

- **La UI debe verse profesional y enterprise**: la competencia es herramientas de CI/CD y QA enterprise, no apps de consumo
- **El espacio de nombres (Espacio activo) debe ser visible en todo momento**: el scoping jerárquico es un diferenciador que debe reflejarse visualmente
- **La evidencia (video, screenshots, traces) debe dominar sobre configuración**: los artefactos son el producto final del usuario, no los settings
- **El recorder integrado debe ser accesible desde la UI principal**: no es una feature secundaria — es el punto de entrada para testers no-técnicos
- **El feedback en vivo de ejecución debe estar prominente**: WebSocket permite mostrar progreso en tiempo real, esto debe ser visible y no escondido en un log

## Fuentes / Referencias

- Skill: obviously-awesome (April Dunford) — Positioning Canvas, 5-Step Process
- Suposiciones: basado en análisis de features visibles en el codebase (commits, estructura de Prisma, worker files, RBAC helpers)
- No acceso a usuarios reales para validar alternativas competitivas — las alternativas fueron inferidas del dominio funcional
- Categorización de mercado basada en analogía con productos conocidos (ReportPortal, TestRail, Xray, qTest)
