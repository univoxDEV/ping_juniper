const Client = require('ssh2').Client
const read = require('read')
const yargs = require('yargs')
const fs = require('fs')

const argv = yargs.options({ // recebe parametros direto da linha de comando
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

/**
 * Se houver o parametro para escrever em um arquivo, será escrito no arquivo e no stdout, caso contrário somente no stdout
 * @param {String} data
 */
const writeAndLog = (data) => {
  data = data.replace('\n', '')
  argv.file && fs.appendFileSync(argv.file, data)
  console.log(data)
}

read({ prompt: 'Password: ', silent: true, output: process.stderr }, (err, password) => { // le a senha do SSH (de forma que não apareça na tela nem tenha que ser colocada por comando
  process.stdin.resume()
  const conn = new Client()
  conn.on('ready', () => {
    let last = -1 // primeiro ping geralmente começa com 0
    let printAll = false // para não imprimir o cabeçalho da pagina
    conn.shell((err, stream) => {
      if (err) throw err
      process.on('SIGINT', () => stream.write('\x03exit\n')) //caso processo seja interrompido será iniciado a interrupção do ping no roteador
      stream.on('data', data => {
        let line = data.toString()
        if (line.match(/PING/)) printAll = true // primeira linha do resultado do ping
        if (line.match(/(unknown command\.|syntax error.)/)) { // caso o usuario tenha digitado o comando errado e gerou um erro no roteador
          console.log(line.match(/(unknown command\.|syntax error.)/)[1])
          conn.end()
          process.exit()
        }
        let match = line.match(/(?<bytes>\d+?) bytes from (?<ip>.*?)(?:: |, )icmp_seq=(?<seq>\d+?) (?:ttl|hlim)=(?<ttl>\d+?) time=(?<time>[0-9.]+?) ms/) // procura pela linha de resposta do ping, pegando como parametro todas as variaveis (vai que né ¯\_(ツ)_/¯)
        if (match) { // caso encontre a linha verifica se o ping é sequencial
          if (Number(match[3]) - last !== 1) { // caso ping não seja sequencial verifica quantos pings foram perdidos e completa o log com "no answer yet for icmp_seq={numero do ping}"
            Array.from(Array(Number(match[3]) - (last + 1)).keys()).forEach(num => writeAndLog(`no answer yet for icmp_seq=${last + num + 1}`))
          }
          writeAndLog(line)
          last = Number(match[3])
        } else if (printAll) {
          writeAndLog(line)
        }
        if (line.match(/round-trip min\/avg\/max/)) { // identifca o final do ping e fecha a conexão
          conn.end()
          process.exit()
        }
      })
      setTimeout(() => stream.write(`${argv.command}\n`)) // executa o comando
    })
  }).on('error', err => {
    if (err.level === 'client-authentication') console.log('Senha incorreta')
    else console.log(err.level)
    process.exit(1)
  }).connect({
    host: argv.host,
    username: argv.user,
    password: password
  })
})