const fs = require('fs')
const yargs = require('yargs')

const argv = yargs.option('file', {
        alias: 'f',
        description: 'Caminho do arquivo que será usado',
        demandOption: true,
        type: 'string'
}).argv

let ping = fs.readFileSync(argv.file)
last = -1
ping.toString().split('\n').map(line => {
    let match = line.match(/^(?<bytes>\d+?) bytes from (?<ip>.*?)(?:: |, )icmp_seq=(?<seq>\d+?) (?:ttl|hlim)=(?<ttl>\d+?) time=(?<time>[0-9\.]+?) ms/)
    if (match) {
        if (Number(match[3]) - last === 1) {
            console.log(line.replace('\n', ''))
        } else {
            Array.from(Array(Number(match[3]) - (last)).keys()).forEach(num => console.log(`no answer yet for icmp_seq=${last + num + 1}`))
        }
        last = Number(match[3])
    } else {
        console.log(line)
    }
})