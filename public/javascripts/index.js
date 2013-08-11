
$( document ).ready( function () {
    
    /*
        When a BCS url is entered, verify that it is running 4.0
    */
    $('#bcs').on('change', function (event) {
        $.get(event.target.value + '/api/device', function (data) {
            if(data.version === '4.0.0') {
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
});
