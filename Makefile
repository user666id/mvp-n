# mvp-n.net — project Makefile

.PHONY: api connect awg-server bot frontend docker-up docker-down tidy

api:
	cd api && go build -o api . && ./api

connect:
	cd connect && go build -o connect . && ./connect

awg-server:
	cd awg-server && go build -o awg-server . && ./awg-server

bot:
	cd bot && npm install && npm run dev

frontend:
	cd frontend && npm install && npm run dev

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

tidy:
	cd api && go mod tidy
	cd connect && go mod tidy
	cd awg-server && go mod tidy

