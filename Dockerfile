# ETAP 1: Budowanie (GitHub)
FROM node:24-alpine AS builder
WORKDIR /app
# Kopiowaniue tylko plików z listą paczek
COPY package*.json ./
# Instalowanie zależności
RUN npm install
# Kopiowanie reszty kodu
COPY . .

# ETAP 2: Uruchamianie (serwer)
FROM node:24-alpine
WORKDIR /app
# Kopiowanie tylko gotowych paczek produkcyjnych (odchudza obraz)
COPY package*.json ./
RUN npm install --omit=dev
# Kopiowanie same kodu z Etapu 1
COPY --from=builder /app ./
# Serwer nasłuchuje na porcie 3000
EXPOSE 3000
# Komenda startowa
CMD ["npm", "start"]
