// Package migrations embeds the SQL migration files in this folder so the
// binary can apply them without needing the folder on disk.
package migrations

import "embed"

// FS holds this folder. The pattern is "*" rather than "*.sql" because embed
// fails on a pattern with no matches; goose only reads files named
// NNNNN_name.sql and ignores the rest.
//
//go:embed *
var FS embed.FS
