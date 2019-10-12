var d,h,m,animate;

function init(){
    d=new Date();
    h=d.getHours();
    m=d.getMinutes();
    clock();
};

function clock(){
if(m==60){
    m=0;
    h++;
    if(h==24){
        h=0;
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