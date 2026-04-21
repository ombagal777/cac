import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import cac from '../src/index.ts'

const tmpDir = join(tmpdir(), 'cac-config-test')

function writeConfig(name: string, data: unknown): string {
  const filePath = join(tmpDir, name)
  writeFileSync(filePath, JSON.stringify(data))
  return filePath
}

function writeRaw(name: string, content: string): string {
  const filePath = join(tmpDir, name)
  writeFileSync(filePath, content)
  return filePath
}

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true })
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('no --config supplied', () => {
  test('uses option defaults when no config is provided', () => {
    const cli = cac()
    cli.config()
    cli.option('--foo <value>', 'Foo option', { default: 'default-foo' })

    const { options } = cli.parse(['node', 'bin'])
    expect(options.foo).toBe('default-foo')
  })

  test('uses CLI arg when no config is provided', () => {
    const cli = cac()
    cli.config()
    cli.option('--foo <value>', 'Foo option', { default: 'default-foo' })

    const { options } = cli.parse(['node', 'bin', '--foo', 'cli-foo'])
    expect(options.foo).toBe('cli-foo')
  })
})

describe('option value precedence', () => {
  test('config value overrides option default', () => {
    const cli = cac()
    cli.config()
    cli.option('--foo <value>', 'Foo option', { default: 'default-foo' })

    const configFile = writeConfig('test.json', { foo: 'config-foo' })
    const { options } = cli.parse(['node', 'bin', '--config', configFile])
    expect(options.foo).toBe('config-foo')
  })

  test('CLI arg overrides config value', () => {
    const cli = cac()
    cli.config()
    cli.option('--foo <value>', 'Foo option', { default: 'default-foo' })

    const configFile = writeConfig('test.json', { foo: 'config-foo' })
    const { options } = cli.parse([
      'node',
      'bin',
      '--config',
      configFile,
      '--foo',
      'cli-foo',
    ])
    expect(options.foo).toBe('cli-foo')
  })

  test('all three layers: default < config < CLI', () => {
    const cli = cac()
    cli.config()
    cli.option('--a <val>', 'A', { default: 'a-default' })
    cli.option('--b <val>', 'B', { default: 'b-default' })
    cli.option('--c <val>', 'C', { default: 'c-default' })

    const configFile = writeConfig('test.json', { a: 'a-config', b: 'b-config' })
    const { options } = cli.parse([
      'node',
      'bin',
      '--config',
      configFile,
      '--a',
      'a-cli',
    ])
    // CLI wins over config and default
    expect(options.a).toBe('a-cli')
    // Config wins over default
    expect(options.b).toBe('b-config')
    // Default still applies when neither config nor CLI set it
    expect(options.c).toBe('c-default')
  })

  test('config applies to command options', () => {
    const cli = cac()
    cli.config()

    let capturedOptions: Record<string, unknown> = {}
    cli
      .command('build [entry]', 'Build')
      .option('--minify', 'Minify output')
      .action((_entry, opts) => {
        capturedOptions = opts
      })

    const configFile = writeConfig('test.json', { minify: true })
    cli.parse(['node', 'bin', 'build', '--config', configFile])
    expect(capturedOptions.minify).toBe(true)
  })

  test('config applies to global options', () => {
    const cli = cac()
    cli.config()
    cli.option('--verbose', 'Verbose mode')

    let capturedOptions: Record<string, unknown> = {}
    cli.command('build').action((_opts) => {
      capturedOptions = cli.options
    })

    const configFile = writeConfig('test.json', { verbose: true })
    cli.parse(['node', 'bin', 'build', '--config', configFile])
    expect(capturedOptions.verbose).toBe(true)
  })
})

describe('dot-nested config keys', () => {
  test('dot-nested key in config maps to nested option', () => {
    const cli = cac()
    cli.config()
    cli.option('--env.* <value>', 'Env vars')

    const configFile = writeConfig('test.json', { 'env.API_SECRET': 'secret' })
    const { options } = cli.parse(['node', 'bin', '--config', configFile])
    expect(options.env).toEqual({ API_SECRET: 'secret' })
  })

  test('deeply dot-nested config key', () => {
    const cli = cac()
    cli.config()
    cli.option('--env.* <value>', 'Env vars')

    const configFile = writeConfig('test.json', {
      'env.DB_HOST': 'localhost',
      'env.DB_PORT': '5432',
    })
    const { options } = cli.parse(['node', 'bin', '--config', configFile])
    expect(options.env).toEqual({ DB_HOST: 'localhost', DB_PORT: '5432' })
  })

  test('CLI arg overrides dot-nested config value', () => {
    const cli = cac()
    cli.config()
    cli.option('--env.* <value>', 'Env vars')

    const configFile = writeConfig('test.json', { 'env.HOST': 'config-host' })
    const { options } = cli.parse([
      'node',
      'bin',
      '--config',
      configFile,
      '--env.HOST',
      'cli-host',
    ])
    expect(options.env).toEqual({ HOST: 'cli-host' })
  })
})

describe('array type config injection', () => {
  test('array value from config with type: []', () => {
    const cli = cac()
    cli.config()
    cli.option('--files <file>', 'Input files', { type: [] })

    const configFile = writeConfig('test.json', { files: ['a.js', 'b.js'] })
    const { options } = cli.parse(['node', 'bin', '--config', configFile])
    expect(options.files).toEqual(['a.js', 'b.js'])
  })

  test('single string from config wrapped into array with type: []', () => {
    const cli = cac()
    cli.config()
    cli.option('--files <file>', 'Input files', { type: [] })

    const configFile = writeConfig('test.json', { files: 'single.js' })
    const { options } = cli.parse(['node', 'bin', '--config', configFile])
    expect(options.files).toEqual(['single.js'])
  })

  test('CLI array arg overrides config array', () => {
    const cli = cac()
    cli.config()
    cli.option('--files <file>', 'Input files', { type: [] })

    const configFile = writeConfig('test.json', { files: ['config.js'] })
    const { options } = cli.parse([
      'node',
      'bin',
      '--config',
      configFile,
      '--files',
      'cli.js',
    ])
    expect(options.files).toEqual(['cli.js'])
  })
})

describe('boolean config injection', () => {
  test('boolean true from config', () => {
    const cli = cac()
    cli.config()
    cli.option('--verbose', 'Verbose mode')

    const configFile = writeConfig('test.json', { verbose: true })
    const { options } = cli.parse(['node', 'bin', '--config', configFile])
    expect(options.verbose).toBe(true)
  })

  test('boolean false from config', () => {
    const cli = cac()
    cli.config()
    cli.option('--no-clear-screen', 'Disable clear screen')

    const configFile = writeConfig('test.json', { clearScreen: false })
    const { options } = cli.parse(['node', 'bin', '--config', configFile])
    expect(options.clearScreen).toBe(false)
  })

  test('CLI flag overrides boolean from config', () => {
    const cli = cac()
    cli.config()
    cli.option('--verbose', 'Verbose mode')

    const configFile = writeConfig('test.json', { verbose: false })
    const { options } = cli.parse([
      'node',
      'bin',
      '--config',
      configFile,
      '--verbose',
    ])
    expect(options.verbose).toBe(true)
  })
})

describe('error cases', () => {
  test('missing config file throws CACError', () => {
    const cli = cac()
    cli.config()
    cli.option('--foo <val>', 'Foo')

    expect(() => {
      cli.parse(['node', 'bin', '--config', '/nonexistent/path/config.json'])
    }).toThrowError('Cannot read config file')
  })

  test('invalid JSON in config file throws CACError', () => {
    const cli = cac()
    cli.config()
    cli.option('--foo <val>', 'Foo')

    const configFile = writeRaw('invalid.json', '{ not valid json }')
    expect(() => {
      cli.parse(['node', 'bin', '--config', configFile])
    }).toThrowError('Invalid JSON in config file')
  })

  test('config file containing JSON array throws CACError', () => {
    const cli = cac()
    cli.config()
    cli.option('--foo <val>', 'Foo')

    const configFile = writeRaw('array.json', '[1, 2, 3]')
    expect(() => {
      cli.parse(['node', 'bin', '--config', configFile])
    }).toThrowError('must contain a JSON object')
  })

  test('config file containing JSON string throws CACError', () => {
    const cli = cac()
    cli.config()
    cli.option('--foo <val>', 'Foo')

    const configFile = writeRaw('string.json', '"just a string"')
    expect(() => {
      cli.parse(['node', 'bin', '--config', configFile])
    }).toThrowError('must contain a JSON object')
  })

  test('unknown config key throws error when allowUnknownOptions is false', () => {
    const cli = cac()
    cli.config()
    cli.option('--foo <val>', 'Foo')

    cli.command('build').action(() => {})

    const configFile = writeConfig('test.json', { unknownOption: 'value' })
    expect(() => {
      cli.parse(['node', 'bin', 'build', '--config', configFile])
    }).toThrowError('Unknown config option `unknownOption`')
  })

  test('unknown config key is allowed when allowUnknownOptions is set', () => {
    const cli = cac()
    cli.config()
    cli.option('--foo <val>', 'Foo')

    cli
      .command('build')
      .allowUnknownOptions()
      .action(() => {})

    const configFile = writeConfig('test.json', { unknownOption: 'value' })
    expect(() => {
      cli.parse(['node', 'bin', 'build', '--config', configFile])
    }).not.toThrow()
  })
})

describe('help and version flow', () => {
  test('--help with missing config file still shows help (does not throw)', () => {
    const cli = cac()
    cli.config()
    cli.help()
    cli.option('--foo <val>', 'Foo')

    // Should not throw even though config file doesn't exist
    expect(() => {
      cli.parse([
        'node',
        'bin',
        '--config',
        '/nonexistent/config.json',
        '--help',
      ])
    }).not.toThrow()
  })

  test('--version with missing config file still shows version (does not throw)', () => {
    const cli = cac()
    cli.config()
    cli.version('1.0.0')
    cli.option('--foo <val>', 'Foo')

    expect(() => {
      cli.parse([
        'node',
        'bin',
        '--config',
        '/nonexistent/config.json',
        '--version',
      ])
    }).not.toThrow()
  })
})
