package config

import (
	"strings"
	"testing"
)

func envOf(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func TestFromEnvDefaults(t *testing.T) {
	cfg, err := FromEnv(envOf(map[string]string{
		"DB_HOST": "db.example.com", "DB_USER": "tools", "DB_NAME": "tools",
	}))
	if err != nil {
		t.Fatalf("FromEnv: %v", err)
	}
	if cfg.Port != "8080" {
		t.Errorf("Port = %q, want 8080", cfg.Port)
	}
	if cfg.DB.Port != 5432 {
		t.Errorf("DB.Port = %d, want 5432", cfg.DB.Port)
	}
	if cfg.DB.SSLMode != "require" {
		t.Errorf("DB.SSLMode = %q, want require", cfg.DB.SSLMode)
	}
	if cfg.StaticDir != "" {
		t.Errorf("StaticDir = %q, want empty", cfg.StaticDir)
	}
}

func TestFromEnvInvalid(t *testing.T) {
	_, err := FromEnv(envOf(map[string]string{"DB_PORT": "abc", "DB_SSLMODE": "nope"}))
	if err == nil {
		t.Fatal("FromEnv: want error, got nil")
	}
	for _, want := range []string{"DB_HOST is required", "DB_USER is required", "DB_NAME is required", "DB_PORT", "DB_SSLMODE"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not mention %q", err, want)
		}
	}
}

func TestDSN(t *testing.T) {
	d := DB{Host: "db.example.com", Port: 5433, User: "tools", Password: "p@ss:w/rd", Name: "tools", SSLMode: "disable"}
	want := "postgres://tools:p%40ss%3Aw%2Frd@db.example.com:5433/tools?sslmode=disable"
	if got := d.DSN(); got != want {
		t.Errorf("DSN() = %q, want %q", got, want)
	}

	d.Host = "::1"
	if got := d.DSN(); !strings.Contains(got, "@[::1]:5433/") {
		t.Errorf("DSN() = %q, want a bracketed IPv6 host", got)
	}
}
