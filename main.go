package main

import (
	"fmt"
    //"log"
    "encoding/json"
    "io/ioutil"
    "os"
    "os/signal"

    "MossJS/moss"

    "github.com/buaazp/fasthttprouter"
    "github.com/valyala/fasthttp"
)

var resultsMap map[string][]byte

func saveResultsMap() {
    bytes, err := json.Marshal(&resultsMap)
    if err != nil {
        fmt.Println(err)
        return
    }

    err = ioutil.WriteFile("results.json", bytes, 644)
    if err != nil {
        fmt.Println(err)
    }

}

func loadResultsMap() {
    b, err := ioutil.ReadFile("results.json")
    if err != nil {
        fmt.Println(err)
        resultsMap = make(map[string][]byte)
        return
    }
    if string(b) == "null" {
        resultsMap = make(map[string][]byte)
        return
    }
    json.Unmarshal(b, &resultsMap)
}

func getResults(ctx *fasthttp.RequestCtx) {
    id, ok := ctx.UserValue("id").(string)
    if ok != true {
        fmt.Fprintf(ctx, "Bad ID")
    } else {
        if resultsMap[id] != nil {
            fmt.Fprintf(ctx, "%s", resultsMap[id])
        } else {
            matches := moss.GetResults(id)
            json, _ := json.Marshal(matches)
            fmt.Fprintf(ctx, "%s", json)

            resultsMap[id] = json
        }
    }
}

func main() {
    loadResultsMap()

    router := fasthttprouter.New()
    router.ServeFiles("/results/*filepath", "static")
    router.GET("/api/results/:id", getResults)
    
    server := &fasthttp.Server{Handler: router.Handler}

    go func() {
        if err := server.ListenAndServe(":8080"); err != nil {
            fmt.Println(err)
        }
    }()

    // Setting up signal capturing
    stop := make(chan os.Signal, 1)
    signal.Notify(stop, os.Interrupt)

    // Waiting for SIGINT (pkill -2)
    <-stop

    saveResultsMap()

    if err := server.Shutdown(); err != nil {
        fmt.Println(err)
    }
}