
$( document ).ready( function () {
    var bcsVersion;
    /*
        When a BCS url is entered, verify that it is running 4.0
    */
    $('#bcs').on('change', function (event) {
        $.get(event.target.value + '/api/device', function (data) {
            if(data.version === '4.0.0') {
                bcsVersion = data.type;
                $('#bcs').parent().addClass('has-success').removeClass('has-error');
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
    $('form').on('change', function (event) {
       if( $('div.has-success #bcs').length && $('div.has-success #configFile').length ) {
           $('button').removeClass('disabled');
       } else {
           $('button').addClass('disabled');
       }
    });
    
    $('button').on('click', function (event) {
       event.preventDefault();
       
       var dialog = $('#dialog .modal-body');
       dialog.empty();
       
       $('#dialog').modal('show');
       
       $('form').ajaxSubmit({success: function (data) {
           if(data.type !== 'unknown') {
               
               dialog.append("Found valid <strong>" + data.type + "</strong> configuration.<br>");
               
               if(data.device !== bcsVersion) {
                    dialog.append("<div>Device mismatch.  Config for <strong>" + data.device + 
                    "</strong>.  Device <strong>" + bcsVersion + "</strong>. Loading anyway, may result in errors.");
               }
               
               data.config.forEach(function (element) {
                   var id = "elem-" + element.endpoint.replace('/', '-');
                   dialog.append("<div id=\"" + id + "\">Updating " + element.endpoint + " ... </div>");
                   $.post($('#bcs')[0].value + "/api/" + element.endpoint, JSON.stringify(element.data), null, 'json')
                   .done(function (data) {
                       dialog.find('#' + id).append("done");
                   })
                   .fail(function () {
                       dialog.find('#' + id).append("failed");
                   });
               });
           }
       }})
    });
});
