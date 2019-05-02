package moss

import (
	"bytes"
	"fmt"
	"regexp"
	"strconv"

	"github.com/valyala/fasthttp"
	"golang.org/x/net/html"
)

type Match struct {
	FirstFile            string `json:"firstFile"`
	SecondFile           string `json:"secondFile"`
	FirstPercentMatched  int    `json:"firstPercentMatched"`
	SecondPercentMatched int    `json:"secondPercentMatched"`
	Link                 string `json:"link"`
	LinesMatched         int    `json:"linesMatched"`
}

// https://stackoverflow.com/questions/34949554/golang-regexp-named-groups-and-submatches
func parseResults(page []byte) []Match {
	re := regexp.MustCompile("<TR><TD><A HREF=\"(?P<link>[^\"]+)\">(?P<name1>[^ ]+) \\((?P<percent1>\\d+)\\%\\)<\\/A>\\s+<TD><A HREF=\"[^\"]+\">(?P<name2>[^ ]+) \\((?P<percent2>\\d+)\\%\\)<\\/A>\\s+<TD ALIGN=right>(?P<linesMatched>\\d+)")

	matches := []Match{}
	for _, match := range re.FindAllSubmatch(page, -1) {
		link := string(match[1])
		firstFile := string(match[2])
		firstPercentMatched, _ := strconv.Atoi(string(match[3]))
		secondFile := string(match[4])
		secondPercentMatched, _ := strconv.Atoi(string(match[5]))
		linesMatched, _ := strconv.Atoi(string(match[6]))

		matches = append(matches, Match{firstFile, secondFile, firstPercentMatched, secondPercentMatched, link, linesMatched})
	}

	return matches
}

func parseResultsNodes(page []byte) []Match {
	doc, _ := html.Parse(bytes.NewReader(page))
	var matches []Match

	var f func(*html.Node)
	f = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "tr" {

		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			f(c)
		}
	}
	f(doc)

	return matches
}

func GetResults(resultsID string) []Match {
	page := fetchResultsPage(resultsID)
	matches := parseResults(page)

	return matches
}

func fetchResultsPage(resultsID string) []byte {
	_, body, _ := fasthttp.Get(nil, fmt.Sprintf("http://moss.stanford.edu/results/%s", resultsID))
	return body

}
