package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"backend/internal/config"
	"backend/internal/database"
	"backend/internal/router"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("%v (see backend/.env.example)", err)
	}

	db, err := database.Open(context.Background(), cfg.DB)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer db.Close()

	n, err := database.Migrate(context.Background(), db)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	log.Printf("database connected, %d migration(s) applied", n)

	port := cfg.Port
	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           router.New(db),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("server listening on :%s", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	// Wait for an interrupt, then shut down gracefully.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("shutdown: %v", err)
	}
	log.Println("server stopped")
}
