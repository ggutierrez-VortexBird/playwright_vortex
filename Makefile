# Makefile — comando único para levantar/operar todo el stack de VorTest.
# No requiere workspaces de npm, solo invoca los comandos de shell que ya
# existían dispersos entre los dos proyectos y docker-compose.dev.yml.

COMPOSE = docker compose -f docker-compose.dev.yml

.PHONY: up down dev test lint logs recorder

## Levanta todo el stack en Docker (postgres, rabbitmq, engine, web,
## execution-consumer, recorder).
up:
	$(COMPOSE) up

## Baja todo el stack.
down:
	$(COMPOSE) down

## Dev sin Docker para los procesos Node: levanta postgres+rabbitmq en
## contenedores y corre `npm run dev` de vortest-web (web + execution-consumer
## + recorder) y `npm run start:dev` de vortest-engine en paralelo.
## Requiere haber corrido `npm install` en ambos proyectos antes.
dev:
	$(COMPOSE) up postgres rabbitmq -d
	( cd vortest-engine && npm run start:dev ) & \
	( cd vortest-web && npm run dev )

## Grabador en el host: codegen abre una ventana real del navegador en el escritorio, cosa que
## un contenedor no puede mostrar. Usa los secretos del mismo .env que el compose.
recorder:
	cd vortest-web && npm run dev:recorder:host

## Corre los tests de ambos proyectos.
test:
	cd vortest-web && npm test
	cd vortest-engine && npm test

## Corre el lint de ambos proyectos.
lint:
	cd vortest-web && npm run lint
	cd vortest-engine && npm run lint

## Logs del stack en Docker.
logs:
	$(COMPOSE) logs -f
