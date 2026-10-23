// Command migrate manages the database schema. Run it from backend/:
//
//	go run ./cmd/migrate status        list applied and pending migrations
//	go run ./cmd/migrate up            apply all pending migrations
//	go run ./cmd/migrate down          roll back the latest migration
//	go run ./cmd/migrate create <name> add migrations/NNNNN_<name>.sql
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/pressly/goose/v3"

	"backend/internal/config"
	"backend/internal/database"
)

const usage = "usage: migrate status | up | down | create <name>"

// migrationsDir is where create writes new files, relative to backend/.
const migrationsDir = "migrations"

func main() {
	log.SetFlags(0)
	if len(os.Args) < 2 {
		log.Fatal(usage)
	}

	if os.Args[1] == "create" {
		if len(os.Args) != 3 {
			log.Fatal("usage: migrate create <name>")
		}
		if _, err := os.Stat(migrationsDir); err != nil {
			log.Fatalf("%s not found: run this from backend/", migrationsDir)
		}
		goose.SetSequential(true)
		if err := goose.Create(nil, migrationsDir, os.Args[2], "sql"); err != nil {
			log.Fatal(err)
		}
		return
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	ctx := context.Background()
	db, err := database.Open(ctx, cfg.DB)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	p, ok, err := database.NewMigrator(db)
	if err != nil {
		log.Fatal(err)
	}
	if !ok {
		fmt.Println("no migrations yet")
		return
	}

	switch os.Args[1] {
	case "status":
		statuses, err := p.Status(ctx)
		if err != nil {
			log.Fatal(err)
		}
		for _, s := range statuses {
			applied := "pending"
			if s.State == goose.StateApplied {
				applied = "applied " + s.AppliedAt.Local().Format("2006-01-02 15:04:05")
			}
			fmt.Printf("%-40s %s\n", s.Source.Path, applied)
		}
	case "up":
		results, err := p.Up(ctx)
		for _, r := range results {
			fmt.Println(r)
		}
		if err != nil {
			log.Fatal(err)
		}
		if len(results) == 0 {
			fmt.Println("already up to date")
		}
	case "down":
		r, err := p.Down(ctx)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println(r)
	default:
		log.Fatal(usage)
	}
}
