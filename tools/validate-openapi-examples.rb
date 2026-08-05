#!/usr/bin/env ruby

require 'yaml'

api = YAML.load_file(File.expand_path('../docs/openapi.yaml', __dir__))
price = api.fetch('components').fetch('schemas').fetch('Product').fetch('properties').fetch('price')
pattern = price.fetch('pattern')
example = price.fetch('example')

abort "unexpected Product.price pattern: #{pattern}" unless pattern == '^\d+\.\d{2}$'
abort "Product.price example does not match #{pattern}: #{example}" unless Regexp.new(pattern).match?(example)

puts "Product.price example matches schema pattern: #{example}"
