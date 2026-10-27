// Liquidity ranker. Same bound as the desk: 16 paths, cosine against [1, 0, 1].
// It does not sign and it does not hold a key. The browser wallet still signs.
// Run: echo '[{"id":"a","out":2,"impact":0.01,"liquidity":100}]' | go run .
package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
)

type path struct {
	ID        string  `json:"id"`
	Out       float64 `json:"out"`
	Impact    float64 `json:"impact"`
	Liquidity float64 `json:"liquidity"`
}

type hit struct {
	ID    string  `json:"id"`
	Score float64 `json:"score"`
}

func cosine(a, b []float64) float64 {
	var dot, na, nb float64
	for i := range a {
		dot += a[i] * b[i]
		na += a[i] * a[i]
		nb += b[i] * b[i]
	}
	d := math.Sqrt(na) * math.Sqrt(nb)
	if d <= 1e-12 {
		return 0
	}
	return dot / d
}

func main() {
	var paths []path
	if err := json.NewDecoder(os.Stdin).Decode(&paths); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if len(paths) > 16 {
		fmt.Fprintln(os.Stderr, "more than 16 paths")
		os.Exit(1)
	}
	maxOut, maxLiq := 0.0, 0.0
	for _, p := range paths {
		if p.Out > maxOut {
			maxOut = p.Out
		}
		if p.Liquidity > maxLiq {
			maxLiq = p.Liquidity
		}
	}
	query := []float64{1, 0, 1}
	hits := make([]hit, 0, len(paths))
	for _, p := range paths {
		out := 0.0
		liq := 0.0
		if maxOut > 0 {
			out = p.Out / maxOut
		}
		if maxLiq > 0 {
			liq = p.Liquidity / maxLiq
		}
		impact := p.Impact
		if impact > 1 {
			impact = 1
		}
		row := []float64{out, 1 - impact, liq}
		hits = append(hits, hit{ID: p.ID, Score: cosine(query, row)})
	}
	for i := 0; i < len(hits); i++ {
		for j := i + 1; j < len(hits); j++ {
			if hits[j].Score > hits[i].Score {
				hits[i], hits[j] = hits[j], hits[i]
			}
		}
	}
	enc := json.NewEncoder(os.Stdout)
	if err := enc.Encode(hits); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
