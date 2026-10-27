// Package config loads the server settings from environment variables,
// optionally read from a .env file.
package config

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds every setting the backend reads at startup.
type Config struct {
	Port string
	// StaticDir is the built frontend to serve next to the API; empty serves the API only.
	StaticDir string
	DB        DB
}

// DB holds the PostgreSQL connection settings.
type DB struct {
	Host     string
	Port     int
	User     string
	Password string
	Name     string
	SSLMode  string
}

// sslModes are the sslmode values PostgreSQL accepts.
var sslModes = map[string]bool{
	"disable": true, "allow": true, "prefer": true,
	"require": true, "verify-ca": true, "verify-full": true,
}

// Load reads .env from the working directory if it exists (variables already
// set in the environment win), then builds and validates the Config.
func Load() (Config, error) {
	if err := godotenv.Load(); err != nil && !errors.Is(err, os.ErrNotExist) {
		return Config{}, fmt.Errorf("read .env: %w", err)
	}
	return FromEnv(os.Getenv)
}

// FromEnv builds a Config from getenv, applying defaults and checking that
// the required database settings are present.
func FromEnv(getenv func(string) string) (Config, error) {
	get := func(key, fallback string) string {
		if v := strings.TrimSpace(getenv(key)); v != "" {
			return v
		}
		return fallback
	}

	cfg := Config{
		Port:      get("PORT", "8080"),
		StaticDir: get("STATIC_DIR", ""),
		DB: DB{
			Host:     get("DB_HOST", ""),
			User:     get("DB_USER", ""),
			Password: getenv("DB_PASSWORD"), // not trimmed: spaces may be part of it
			Name:     get("DB_NAME", ""),
			SSLMode:  get("DB_SSLMODE", "require"),
		},
	}

	var problems []string
	for _, req := range []struct{ key, value string }{
		{"DB_HOST", cfg.DB.Host}, {"DB_USER", cfg.DB.User}, {"DB_NAME", cfg.DB.Name},
	} {
		if req.value == "" {
			problems = append(problems, req.key+" is required")
		}
	}
	port, err := strconv.Atoi(get("DB_PORT", "5432"))
	if err != nil || port < 1 || port > 65535 {
		problems = append(problems, "DB_PORT must be a number from 1 to 65535")
	}
	cfg.DB.Port = port
	if !sslModes[cfg.DB.SSLMode] {
		problems = append(problems, "DB_SSLMODE must be one of disable, allow, prefer, require, verify-ca, verify-full")
	}
	if len(problems) > 0 {
		return Config{}, fmt.Errorf("invalid config: %s", strings.Join(problems, "; "))
	}
	return cfg, nil
}

// DSN returns the connection URL for d, with the user and password escaped.
func (d DB) DSN() string {
	u := url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(d.User, d.Password),
		Host:     net.JoinHostPort(d.Host, strconv.Itoa(d.Port)),
		Path:     "/" + d.Name,
		RawQuery: url.Values{"sslmode": {d.SSLMode}}.Encode(),
	}
	return u.String()
}
