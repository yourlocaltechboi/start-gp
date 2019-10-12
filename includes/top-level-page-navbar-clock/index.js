var d,h,m,s,animate;

function init(){
    window.setInterval(function(){
        d=new Date();
        h=d.getHours();
        m=d.getMinutes();
        s=d.getSeconds();
        clock();
      }, 5000);       
};

function clock(){
    ++s
    if(s==60){
        ++m
        if(m==60){
            m=0;
            h++;
            if(h==13){
                h=1;
            }
        }
    }
    $('min',m);
    $('hr',h);
    animate=setTimeout(clock,1000);
};

function $(id,val){
    if(val<10){
        val='0'+val;
    }
    document.getElementById(id).innerHTML=val;
};

window.onload=init;