function getIPAddress(){
    var interfaces = require('os').networkInterfaces();
    for(var devName in interfaces){
        var iface = interfaces[devName];
        for(var i=0;i<iface.length;i++){
            var alias = iface[i];
            if(alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal){
                return alias.address;
            }
        }
    }
}
console.log(getIPAddress()) // 本地ip

exports.IPv4 = getIPv4;
function getIPv4()
{
    return getIPAddress();
}


function getPublicIP() {
    const os = require("os");
    const ifaces = os.networkInterfaces();
    let en0;

    Object.keys(ifaces).forEach((ifname) => {
        let alias = 0;

        ifaces[ifname].forEach(function (iface) {
            if ("IPv4" !== iface.family || iface.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return;
            }

            if (alias >= 1) {
                // this single interface has multiple ipv4 addresses
                en0 = iface.address;
                //console.log(ifname + ":" + alias, iface.address);
            } else {
                // this interface has only one ipv4 adress
                //console.log(ifname, iface.address);
                en0 = iface.address;
            }
            ++alias;
        });
    });
    return en0;
};

exports.PublicIP = getPublicIPAddress;
function getPublicIPAddress()
{
    return getPublicIP();
}

console.log(getPublicIP())