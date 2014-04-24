/*global Migrator */
(function () {

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

    
})();
