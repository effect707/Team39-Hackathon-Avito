package migrationfiles

import "embed"

//go:embed *.sql
var Files embed.FS

//go:embed seed.sql
var SeedSQL []byte
