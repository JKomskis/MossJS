FROM golang:1.12

WORKDIR /go/src/MossJS
COPY . .

RUN go get -d -v ./...
RUN go install -v ./...

CMD ["MossJS"]