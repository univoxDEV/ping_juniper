const Client = require('ssh2').Client
const read = require('read')
const yargs = require('yargs')
const fs = require('fs')

const argv = yargs.options({
  'host': {
    alias: 'h',
    description: 'IP do roteador',
    demandOption: true,
    type: 'string'
  },
  'user': {
    alias: 'u',
    description: 'Usuario do roteador',
    demandOption: true,
    type: 'string'
  },
  'command': {
    alias: 'c',
    description: 'Comando que será executado',
    demandOption: true,
    type: 'string'
  },
  'file': {
    alias: 'f',
    description: 'Arquivo para salvar o LOG',
    type: 'string'
  }
}).argv

const writeAndLog = (data) => {
  argv.file && fs.appendFileSync(argv.file, data)
  console.log(data)
}

read({
  prompt: 'Password: ',
  silent: true,
  output: process.stderr
}, (err, password) => {
  process.stdin.resume()
  const conn = new Client()
  conn.on('ready', () => {
    let last = -1
    let printAll = false
    conn.shell((err, stream) => {
      if (err) throw err
      process.on('SIGINT', () => stream.write('\x03exit\n'))
      stream.on('data', data => {
        let line = data.toString()
        if (line.match(/PING/)) printAll = true
        let match = line.match(/(?<bytes>\d+?) bytes from (?<ip>.*?)(?:: |, )icmp_seq=(?<seq>\d+?) (?:ttl|hlim)=(?<ttl>\d+?) time=(?<time>[0-9.]+?) ms/)
        if (match) {
          if (Number(match[3]) - last === 1) {
            writeAndLog(line.replace('\n', ''))
          } else {
            Array.from(Array(Number(match[3]) - (last + 1)).keys()).forEach(num => writeAndLog(`no answer yet for icmp_seq=${last + num + 1}`))
            writeAndLog(line.replace('\n', ''))
          }
          last = Number(match[3])
        } else if (printAll) {
          writeAndLog(line.replace('\n', ''))
        }
        if (line.match(/round-trip min\/avg\/max/)) {
          conn.end()
          process.exit()
        }
      })
      setTimeout(() => stream.write(`${argv.command}\n`))
    })
  }).on('error', () => {
    console.log('Senha incorreta')
    process.exit(1)
  }).connect({
    host: argv.host,
    username: argv.user,
    password: password
  })
})