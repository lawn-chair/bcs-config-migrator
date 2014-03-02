
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
        } else if(fileType === 'process') {
            _config = parseProcessFile(elements);
        }
        
        res.json({
            type: fileType,
            device: elements[0].substring(0, 7),
            config: _config
        });
    });
    
};

var booleanElement = function (n) {
    return parseInt(n) ? true : false;
};

var parseSystemFile = function(elements) {
    var ret = [];
    
    /*
        Tell the client which API calls will be necessary to restore the config
        Skip: 
            network (could cause loss of connectivity)
            datalog (not yet implemented in API)
        
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
    });
    
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
    
    for(i = 0; i < 8; i++) {
        ret.push({
            endpoint: 'process/' + i,
            data: {
                'run_on_startup': parseInt(elements[197 + (i % 4)]) & (1 << (i / 4)) ? true: false,

            }
        });
    }
    
    for(i = 0; i < 8; i++) {
        for(var j = 0; j < 8; j++) {
            var outputControllers = [];
            
            for(var oc = 0; oc < 6; oc++) {
                outputControllers[oc] = {
                    heat: booleanElement(elements[175 + oc]),
                    input: parseInt(elements[169 + oc]),
                    swing: parseInt(elements[274 + oc])
                }
            }
            
            ret.push({
                endpoint: 'process/' + i + "/state/" + j + '/output_controllers',
                data: outputControllers
            });
        }
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
                    holdoff: parseInt(elements[227]) * 10,
                    time: parseInt(elements[228]) * 10
                }
            });
            break;
        case 2:
            ret.push({
                endpoint: 'igniter/0',
                data: {
                    outputs: [0, 1],
                    igniter: 5,
                    holdoff: parseInt(elements[227]) * 10,
                    time: parseInt(elements[228]) * 10
                }
            });
            break;
        case 3:
            ret.push({
                endpoint: 'igniter/0',
                data: {
                    outputs: [0, 1, 2],
                    igniter: 5,
                    holdoff: parseInt(elements[227]) * 10,
                    time: parseInt(elements[228]) * 10
                }
            });
            break;
        case 4:
            ret.push({
                endpoint: 'igniter/0',
                data: {
                    outputs: [0],
                    igniter: 3,
                    holdoff: parseInt(elements[227]) * 10,
                    time: parseInt(elements[228]) * 10
                }
            });
            ret.push({
                endpoint: 'igniter/1',
                data: {
                    outputs: [1],
                    igniter: 4,
                    holdoff: parseInt(elements[227]) * 10,
                    time: parseInt(elements[228]) * 10
                }
            });
            ret.push({
                endpoint: 'igniter/2',
                data: {
                    outputs: [2],
                    igniter: 5,
                    holdoff: parseInt(elements[227]) * 10,
                    time: parseInt(elements[228]) * 10
                }
            });
            break;
        case 7:
            ret.push({
                endpoint: 'igniter/2',
                data: {
                    outputs: [2],
                    igniter: null,
                    holdoff: parseInt(elements[227]) * 10,
                    time: parseInt(elements[228]) * 10
                }
            });
            //FALLTHROUGH!

        case 6:
            ret.push({
                endpoint: 'igniter/1',
                data: {
                    outputs: [1],
                    igniter: null,
                    holdoff: parseInt(elements[227]) * 10,
                    time: parseInt(elements[228]) * 10
                }
            });
            //FALLTHROUGH!

        case 5:
            ret.push({
                endpoint: 'igniter/0',
                data: {
                    outputs: [0],
                    igniter: null,
                    holdoff: parseInt(elements[227]) * 10,
                    time: parseInt(elements[228]) * 10
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
        });
    }
    
    return ret
};

var parseProcessFile = function (elements) {
    var ret = [];
    
    ret.push({
        endpoint: 'process/:id',
        data: {
            name: elements[1].trim()
        }
    });
    
    for(var i = 0; i < 4; i++) {
        ret.push({
            endpoint: 'process/:id/win/' + i,
            data: {
                name: elements[14 + i].trim()
            }
        });
        
        ret.push({
            endpoint: 'process/:id/timer/' + i,
            data: {
                name: elements[10 + i].trim()
            }
        });
    }
    
    for(i = 0; i < 8; i++) {
        ret.push({
            endpoint: 'process/:id/state/' + i,
            data: {
                name: elements[2 + i].trim(),
                ramp: {
                    enable: booleanElement(elements[130 + (i * 124)]),
                    output: parseInt(elements[131 + (i * 124)]),
                    start: parseInt(elements[1029 + (i * 32)]),
                    end: parseInt(elements[1039 + (i * 32)]),
                    time: parseInt(elements[1040 + (i * 32)])
                },
                'state_alarm': booleanElement(elements[133 + (i * 124)]),
                'email_alarm': booleanElement(elements[138 + (1 * 124)]),
                'timers': parseTimers(elements, i)
            }
        });
        
        ret.push({
            endpoint: 'process/:id/state/' + i + '/exit_conditions',
            data: parseExitConditions(elements, i)
        });
        
        ret.push({
            endpoint: 'process/:id/state/' + i + '/output_controllers',
            data: parseOutputControllers(elements, i)
        });
    }
    return ret;
};

var parseTimers = function(elements, state) {
    var ret = [];
    
    for(var i = 0; i < 4; i++) {
        ret.push({
            'used': booleanElement(elements[36 + i + (state * 124)]),
            'count_up': booleanElement(elements[40 + i + (state * 124)]),
            'preserve': booleanElement(elements[134 + (state * 124)] & (1 << i)),
            'init': parseInt(elements[1010 + i + (state * 32)])
        });
    }
    
    return ret;
}

var parseExitConditions = function (elements, state) {
    var ret = [];
    
    for(var i = 0; i < 4; i++) {
        var ec_source = getECSource(elements, state, i);
        ret.push({
            'enabled': ec_source !== 0 ? true : false,
            'source_type': ec_source,
            'source_number': getECSourceNumber(elements, state, i, ec_source),
            'next_state': parseInt(elements[114 + i + (state * 124)]),
            'condition': parseInt(elements[126 + i + (state * 124)]),
            'value': getECValue(elements, state, i, ec_source)
        });
    }
    return ret;
};


var getECSource = function (elements, state, ec) {
    if(elements.slice(50 + (ec * 4) + (state * 124), 54 + (ec * 4) + (state * 124)).reduce(function (a, b) { return a + b }) > 0) {
        
        return 1; // Temp
        
    } else if (elements.slice(66 + (ec * 4) + (state * 124), 70 + (ec * 4) + (state * 124)).reduce(function (a, b) { return a + b }) > 0) {
        
        return 2; // Time
        
    } else if (elements.slice(82 + (ec * 4) + (state * 124), 86 + (ec * 4) + (state * 124)).reduce(function (a, b) { return a + b }) > 0) {
        
        return 3; // Din
        
    } else if (elements.slice(98 + (ec * 4) + (state * 124), 102 + (ec * 4) + (state * 124)).reduce(function (a, b) { return a + b }) > 0) {
        
        return 4; // Win
    }
    
    return 0; // Unused
};

var getECSourceNumber = function (elements, state, ec, type) {
    switch(type) {
        case 0:
            return 0;
        case 1:
            for(var i = 0; i < 4; i++) {
                if(parseInt(elements[50 + i + (ec * 4) + (state * 124)]) & 1) {
                    return i;
                } else if(parseInt(elements[50 + i + (ec * 4) + (state * 124)]) & 2) {
                    return i + 4;
                }
            }
            break;
        case 2:
            for(i = 0; i < 4; i++) {
                if(parseInt(elements[66 + i + (ec * 4) + (state * 124)]) === 1) {
                    return i;
                }
            }
            break;
        case 3:
            for(i = 0; i < 4; i++) {
                if(parseInt(elements[82 + i + (ec * 4) + (state * 124)]) & 1) {
                    return i;
                } else if(parseInt(elements[82 + i + (ec * 4) + (state * 124)]) & 2) {
                    return i + 4;
                }
            }
            break;
        case 4:
            for(i = 0; i < 4; i++) {
                if(parseInt(elements[98 + i + (ec * 4) + (state * 124)]) === 1) {
                    return i;
                }
            }
    }
}

var getECValue = function (elements, state, ec, type) {
    switch(type) {
        case 0:
        case 4:
            return 0;
        case 1:
            return parseInt(elements[1020 + ec + (state * 32)]);
        case 2:
            return parseInt(elements[1024 + ec + (state * 32)]);
        case 3:
            return parseInt(elements[118 + ec + (state * 124)]);
    }
    return 0;
}

var parseOutputControllers = function (elements, state) {
    var ret = [];

    for(i = 0; i < 6; i++) {
        var sp;
        switch(parseInt(elements[18 + i + (state * 124)])) {
            case 0: // FALLTHROUGH
            case 1:
                sp = parseInt(elements[44 + i + (state * 124)]) ? 1 : 0;
                break;
            case 2:
                sp = parseInt(elements[44 + i + (state * 124)]);
                break;
            case 3: // FALLTHROUGH
            case 4:
                sp = parseInt(elements[1014 + i + (state * 32)])
        }
        
        ret.push({
            mode: parseInt(elements[18 + i + (state * 124)]),
            input: parseInt(elements[31 + i + (state * 32)]),
            setpoint: sp
        })
    }
    
    return ret;
}