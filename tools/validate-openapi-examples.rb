#!/usr/bin/env ruby

require 'yaml'

api = YAML.load_file(File.expand_path('../docs/openapi.yaml', __dir__))
price = api.fetch('components').fetch('schemas').fetch('Product').fetch('properties').fetch('price')
pattern = price.fetch('pattern')
example = price.fetch('example')

abort "unexpected Product.price pattern: #{pattern}" unless pattern == '^\d+\.\d{2}$'
abort "Product.price example does not match #{pattern}: #{example}" unless Regexp.new(pattern).match?(example)

error_codes = api.fetch('components').fetch('schemas').fetch('ErrorEnvelope').fetch('properties').fetch('error')
  .then { |error| api.fetch('components').fetch('schemas').fetch(error.fetch('$ref').split('/').last) }
  .fetch('properties').fetch('code').fetch('enum')
runtime_codes = %w[NOT_IMPLEMENTED UNAUTHORIZED NOT_FOUND METHOD_NOT_ALLOWED INTERNAL SERVICE_UNAVAILABLE]
missing_codes = runtime_codes - error_codes
abort "OpenAPI ErrorEnvelope misses runtime codes: #{missing_codes.join(', ')}" unless missing_codes.empty?

puts "Product.price example matches schema pattern: #{example}"
puts 'OpenAPI ErrorEnvelope contains every platform runtime code'
