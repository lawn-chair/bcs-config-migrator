
/*
 * POST migrate
 */
var fs = require('fs');

exports.migrate = function(req, res){
    var elements = [];

    fs.readFile(req.files.configFile.path, function (err, data) {
        if(err) { console.log(err); return err }
        
        elements = data.toString().split(',');
                
        var fileType = elements.length === 666 ? 'system' : elements.length === 1267 ? 'process' : 'unknown';    
        var _config;
        
        if(fileType === 'system')
        {
            _config = parseSystemFile(elements);
        }
        
        res.json({
            type: fileType,
            device: elements[0].substring(0, 7),
            config: _config
        });
    });
    
};

var parseSystemFile = function(elements) {
    var ret = [];
    
    var booleanElement = function (n) {
        return parseInt(n) ? true : false;
    }
    /*
        Tell the client which API calls will be necessary to restore the config
        Skip: 
            network (could cause loss of connectivity)
        
    */
    
    ret.push({
        endpoint: 'device',
        data: {
            name: (elements[1] + elements[2]).trim()
        }
    });
    
    ret.push({
        endpoint: 'system',
        data: {
            celsius: booleanElement(elements[203]),
            'alarm_to_reg10': booleanElement(elements[231]),
            'require_auth': booleanElement(elements[188])
        }
    })
    
    for(var i = 0; i < 18; i++) {
        ret.push({
            endpoint: 'output/' + i,
            data: {
                name: elements[3 + i].trim(),
                enabled: parseInt(elements[127 + (i % 6)]) & (1 << (i / 6)) ? true : false
            }
        });    
    }

    for(i = 0; i < 8; i++) {
        ret.push({
            endpoint: 'din/' + i,
            data: {
                name: elements[21 + i].trim(),
                enabled: parseInt(elements[107 + (i % 4)]) & (1 << (i / 4)) ? true: false,
                oneshot: parseInt(elements[203]) & (1 << i) ? true: false
            }
        });
    }
    
    for(i = 0; i < 8; i++) {
        coefficient = i < 4 ? 353 : 437;
        ret.push({
           endpoint: 'temp/' + i,
           data: {
               name: elements[29 + i].trim(),
               enabled: parseInt(elements[133 + (i % 4)]) & (1 << (i / 4)) ? true : false,
               coefficients: [
                   parseFloat(elements[coefficient + i]) * 1e-10,
                   parseFloat(elements[coefficient + i + 4]) * 1e-10,
                   parseFloat(elements[coefficient + i + 8]) * 1e-10
                   ]
           }
        });
    }
    
    for(i = 0; i < 6; i++) {
        ret.push({
           endpoint: 'pid/' + i,
           data: {
               'proportional_gain': parseFloat(elements[365 + i]) / 100,
               'integral_gain': parseFloat(elements[371 + i]) / 100,
               'derivative_gain': parseFloat(elements[377 + i]) / 100,
               'integral_max': parseFloat(elements[383 + i]) / 100,
               'integral_min': parseFloat(elements[389 + i]) / 100,
               'output_period': parseInt(elements[282 + i]),
               'sample_period': parseInt(elements[286 + i]),
               'pulse_width_min': parseInt(elements[206 + i]),
               'pulse_width_max': parseInt(elements[212 + i])
           }
        });
    }
    
    var auto_ignite_mode = parseInt(elements[226]);
    switch(auto_ignite_mode) {
        case 0: break;
        case 1:
            ret.push({
                endpoint: 'igniter/0',
                data: {
                    outputs: [0],
                    igniter: 5,
                    holdoff: parseInt(elements[227]),
                    time: parseInt(elements[228])
                }
            });
            break;
        case 2:
            ret.push({
                endpoint: 'igniter/0',
                data: {
                    outputs: [0, 1],
                    igniter: 5,
                    holdoff: parseInt(elements[227]),
                    time: parseInt(elements[228])
                }
            });
            break;
        case 3:
            ret.push({
                endpoint: 'igniter/0',
                data: {
                    outputs: [0, 1, 2],
                    igniter: 5,
                    holdoff: parseInt(elements[227]),
                    time: parseInt(elements[228])
                }
            });
            break;
        case 4:
            ret.push({
                endpoint: 'igniter/0',
                data: {
                    outputs: [0],
                    igniter: 3,
                    holdoff: parseInt(elements[227]),
                    time: parseInt(elements[228])
                }
            });
            ret.push({
                endpoint: 'igniter/1',
                data: {
                    outputs: [1],
                    igniter: 4,
                    holdoff: parseInt(elements[227]),
                    time: parseInt(elements[228])
                }
            });
            ret.push({
                endpoint: 'igniter/2',
                data: {
                    outputs: [2],
                    igniter: 5,
                    holdoff: parseInt(elements[227]),
                    time: parseInt(elements[228])
                }
            });
            break;
        case 7:
            ret.push({
                endpoint: 'igniter/2',
                data: {
                    outputs: [2],
                    igniter: null,
                    reg: 15,
                    holdoff: parseInt(elements[227]),
                    time: parseInt(elements[228])
                }
            });
            //FALLTHROUGH!

        case 6:
            ret.push({
                endpoint: 'igniter/1',
                data: {
                    outputs: [1],
                    igniter: null,
                    reg: 14,
                    holdoff: parseInt(elements[227]),
                    time: parseInt(elements[228])
                }
            });
            //FALLTHROUGH!

        case 5:
            ret.push({
                endpoint: 'igniter/0',
                data: {
                    outputs: [0],
                    igniter: null,
                    reg: 13,
                    holdoff: parseInt(elements[227]),
                    time: parseInt(elements[228])
                }
            });
            break;
        
    }
    
    
    var getSlot = function (rung, slot) {
        var slotData = (parseInt(elements[473 + (rung * 3) + Math.floor(slot / 2)]) >> (slot % 2 === 0 ? 0 : 4)) & 0xFFFF;
        
        return  {
                    wire: slotData >> 12,
                    type: slotData & 0x0F00 >> 8,
                    number: slotData & 0x7F,
                    nc: slotData & 0x80 ? true: false
                };
    };
    
    for(i = 0; i < 40; i++) {
        
        ret.push({
            endpoint: 'ladder/' + i,
            data: {
                slots: [
                    getSlot(i, 0),
                    getSlot(i, 1),
                    getSlot(i, 2),
                    getSlot(i, 3),
                    getSlot(i, 4)
                    ]
            }
        })
    }
    

    return ret
}