/*global Migrator */

var updateDevice = function(dialog, config) {
    var percent = 100 / config.length;
    var successBar = dialog.find('.progress-bar-success')[0];
    var dangerBar = dialog.find('.progress-bar-danger')[0];
    
    /*
        Posting more than 1 state at one time causes the BCS to run out of memory.
        Thank you async!
    */
    async.eachLimit(config, 2, function (element, next) {
        var id = "elem-" + element.endpoint.replace(/\//g, '-');
        
        dialog.append('<div class="row" id="' + id + '"><div class="col-6 col-md-8">Updating ' + element.endpoint + ' ... </div></div>');
        
        $.post($('#bcs')[0].value + "/api/" + element.endpoint, JSON.stringify(element.data), null, 'json')
        .done(function () {
            dialog.find('#' + id).append('<div class="col-6 col-md-4 pull-right"><span class="pull-right label label-success">Done</span></div>');
            $(successBar).attr('aria-valuenow', parseFloat($(successBar).attr('aria-valuenow')) + percent );
            $(successBar).css('width', $(successBar).attr('aria-valuenow') + '%');
            next();
        })
        .fail(function () {
            dialog.find('#' + id).append('<div class="col-6 col-md-4 pull-right"><span class="pull-right label label-danger">Failed</span></div>');
            $(dangerBar).attr('aria-valuenow', parseFloat($(dangerBar).attr('aria-valuenow')) + percent );
            $(dangerBar).css('width', $(dangerBar).attr('aria-valuenow') + '%');
            next();
        });
        
    });
};


$( document ).ready( function () {
    var bcsVersion;
    var processes;
    /*
        When a BCS url is entered, verify that it is running 4.0
    */
    $('#bcs').on('change', function (event) {
        $.get(event.target.value + '/api/device', function (data) {
            if(data.version === '4.0.0') {
                bcsVersion = data.type;
                localStorage['bcs-backup.url'] = event.target.value;
                
                $('#bcs').parent().addClass('has-success').removeClass('has-error');
                
                $('#process').html = "";
                processes = [];
                async.times(8, function (id, next) {
                    $.get(event.target.value + '/api/process/' + id, function (data) {
                        processes.push({id: id, name: data.name});
                        next();
                    });
                },
                function () {
                    processes.sort(function (a,b) { return a.id - b.id; });
                    processes.forEach( function (e) {
                        $('#process').append("<option value=" + e.id + ">" + e.id + " - " + e.name + "</option>");
                    });
                });
                
            } else {
                $('#bcs').parent().addClass('has-error').removeClass('has-success');            
            }
            
            
        })
        .fail(function () {
            $('#bcs').parent().addClass('has-error').removeClass('has-success');
        });
    });
    
    $('#configFile').on('change', function (event) {
        if(event.target.files[0].size) {
           $('#configFile').parent().addClass('has-success').removeClass('has-error');
        } else {
           $('#configFile').parent().addClass('has-error').removeClass('has-success'); 
        }
    });
    
    /*
        If the URL and File are valid, enable the button
    */
    $('form').on('change', function () {
       if( $('div.has-success #bcs').length && $('div.has-success #configFile').length ) {
           $('button').removeClass('disabled');
       } else {
           $('button').addClass('disabled');
       }
    });
    
    /*
        When the button is clicked, submit the file to the web service.
        When the response comes back, pop up a modal dialog for status and
        send all the required configs to the BCS.
    */
    $('button').on('click', function (event) {
        event.preventDefault();
       
        var dialog = $('#dialog .modal-body');
        dialog.empty();
       
        $('#dialog').modal('show');
        
        // Submit fhe file to the web service (see routes/migrate.js)
        Migrator.migrate($('#configFile')[0].files[0], function (data) {
            if(data.type !== 'unknown') {
               
                dialog.append('<div class="alert alert-success">Found valid <strong>' + data.type + '</strong> configuration.</div>');
               
                if(data.device !== bcsVersion) {
                    dialog.append('<div class="alert alert-warning">Device mismatch.  Loading anyway, may result in errors. <ul><li>Config file version: <strong>' + data.device + 
                    '</strong></li><li>Device version: <strong>' + bcsVersion + '</strong></li></div>');
                }
                
                dialog.append($('#progress').html());
               
                if(data.type === 'process') {
                
                    dialog.append($('#process-selector').html());
                    $('#update-process').on('click', function (event) {
                        event.preventDefault();
                        $(event.target).addClass('disabled');
                        var id = dialog.find('select')[0].value;
                        var config = data.config.map(function (e) {
                            e.endpoint = e.endpoint.replace(':id', id);
                            return e;
                        });
                        
                        updateDevice(dialog, config);
                    });
                
                } else {
                   updateDevice(dialog, data.config);
                }
               
            } else {
                dialog.append('<div class="alert alert-danger">Invalid configuration file found</div>');
            }
            
        });
    });

    /*
        Restore the URL on page load if we saved one in localStorage
    */
    if(localStorage['bcs-backup.url'])
    {
        $('[data-name=bcs]').val(localStorage['bcs-backup.url']);
        $('[data-name=bcs]').change();
    }
    
});


/*jshint -W065 */
/*jshint -W098 */

var Migrator = (function () {
    
    var migrate = function(file, next) {
        var elements = [],
            reader;
            
        next = next || function () {};
        
        reader = new FileReader();

        reader.addEventListener("load", function(event) {
            var fileType = 'unknown',
                _config;
                
            elements = event.target.result.toString().split(',');
            
            fileType = elements.length === 666 ? 'system' : elements.length === 1267 ? 'process' : 'unknown';
            if(fileType === 'system') {
                _config = parseSystemFile(elements);
            } else if(fileType === 'process') {
                _config = parseProcessFile(elements);
            }
            
            next({
                type: fileType,
                device: elements[0].substring(0, 7),
                config: _config
            });
        });

        reader.readAsText(file);
        
    };

    var booleanElement = function (n) {
        return parseInt(n) ? true : false;
    };
    
    var parseSystemFile = function(elements) {
        var ret = [],
            coefficient,
            i;
        
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
        
        for(i = 0; i < 18; i++) {
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
                    };
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
        
        var autoIgniteMode = parseInt(elements[226]);
        /*jshint -W086 */
        switch(autoIgniteMode) {
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
        
        return ret;
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
    };
    
    var parseExitConditions = function (elements, state) {
        var ret = [];
        
        for(var i = 0; i < 4; i++) {
            var ecSource = getECSource(elements, state, i);
            ret.push({
                'enabled': ecSource !== 0 ? true : false,
                'source_type': ecSource,
                'source_number': getECSourceNumber(elements, state, i, ecSource),
                'next_state': parseInt(elements[114 + i + (state * 124)]),
                'condition': parseInt(elements[126 + i + (state * 124)]),
                'value': getECValue(elements, state, i, ecSource)
            });
        }
        return ret;
    };
    
    
    var getECSource = function (elements, state, ec) {
        if(elements.slice(50 + (ec * 4) + (state * 124), 54 + (ec * 4) + (state * 124)).reduce(function (a, b) { return a + b; }) > 0) {
            
            return 1; // Temp
            
        } else if (elements.slice(66 + (ec * 4) + (state * 124), 70 + (ec * 4) + (state * 124)).reduce(function (a, b) { return a + b; }) > 0) {
            
            return 2; // Time
            
        } else if (elements.slice(82 + (ec * 4) + (state * 124), 86 + (ec * 4) + (state * 124)).reduce(function (a, b) { return a + b; }) > 0) {
            
            return 3; // Din
            
        } else if (elements.slice(98 + (ec * 4) + (state * 124), 102 + (ec * 4) + (state * 124)).reduce(function (a, b) { return a + b; }) > 0) {
            
            return 4; // Win
        }
        
        return 0; // Unused
    };
    
    var getECSourceNumber = function (elements, state, ec, type) {
        var i;
        switch(type) {
            case 0:
                return 0;
            case 1:
                for(i = 0; i < 4; i++) {
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
    };
    
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
    };
    
    var parseOutputControllers = function (elements, state) {
        var ret = [],
            sp;
    
        for(var i = 0; i < 6; i++) {
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
                    sp = parseInt(elements[1014 + i + (state * 32)]);
            }
            
            ret.push({
                mode: parseInt(elements[18 + i + (state * 124)]),
                input: parseInt(elements[31 + i + (state * 32)]),
                setpoint: sp
            });
        }
        
        return ret;
    };
    
    
    return {
        migrate: migrate
    };
}());