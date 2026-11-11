# Comandos para levantar y operar el stack de VorTest

COMPOSE = docker compose -f docker-compose.dev.yml

.PHONY: up down dev test lint logs recorder

## Levanta todo el stack en Docker
up:
	$(COMPOSE) up

## Baja el stack
down:
	$(COMPOSE) down

## Postgres y rabbitmq en Docker; web y motor con npm (requiere npm install en ambos)
dev:
	$(COMPOSE) up postgres rabbitmq -d
	( cd vortest-engine && npm run start:dev ) & \
	( cd vortest-web && npm run dev )

## Grabador en el host (codegen necesita el escritorio)
recorder:
	cd vortest-web && npm run dev:recorder:host

## Tests de ambos proyectos
test:
	cd vortest-web && npm test
	cd vortest-engine && npm test

## Lint de ambos proyectos
lint:
	cd vortest-web && npm run lint
	cd vortest-engine && npm run lint

## Logs del stack
logs:
	$(COMPOSE) logs -f
