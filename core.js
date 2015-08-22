!function(window, document){
    'use strict';
    //root namespace
    var root = {},
        /* uc9.4以下把location和localStorage对象赋值到一个变量里使用的话，在离开当前页面后返回时，这个变量指向的对象会丢失，再去使用就挂掉了。 */
        encodeURL = window.encodeURIComponent,
        decodeURL = window.decodeURIComponent,
        fnPool = [],
        hashPool = [],
        appModeCount = 0,
        getId = function(id) {
            return document.getElementById(id);
        },
        //设置cookie
        setCookie=function(key, value, expires, domain){
            document.cookie = key + "=" + encodeURL(value)
                + (domain ? ";domain="+domain : "")
                + (expires ? ";path=/;expires=" + expires.toGMTString()+";" : "");
        },
        //获取cookie
        getCookie = function(key){
            var reg = new RegExp("(^| )" + key + "=([^;]*)(;|\x24)"),
                result = reg.exec(document.cookie);

            if (result) {
                return decodeURL(result[2]) || null;
            }

            return null;
        },
        lsCore = (function() {
            var lserror = 0,    // 错误标示锁，避免重复触发
                //localstorage存取失败后封禁1小时
                disableCache = function (callback) {
                    if(!lserror) {
                        lserror = 1;

                        setCookie("lserr", 1, new Date(36e5 + (+new Date())));

                        window.localStorage.clear();

                        callback && callback();
                    }
                },
                lsSupport = (function() {
                    var flag = null,    //
                        key = "^_^";

                    return function() {
                        if(flag === null) {
                            try {
                                flag = (window.localStorage.setItem(key, 1), window.localStorage.getItem(key), window.localStorage.removeItem(key), 1);
                            } catch (e) {
                                flag = 0;
                            }
                        }

                        return flag;
                    };
                })(),
                renderSymbol = function(content) {
                    var strSvg, doc;
                    strSvg = [
                        '<svg style="display:none" version="1.1" xmlns="http://www.w3.org/2000/svg">',
                            '<defs>',
                                content,
                            '</defs>',
                        '</svg>'
                    ].join('');

                    try {
                        doc = new DOMParser().parseFromString(strSvg, 'application/xml');
                        document.body.appendChild(document.importNode(doc.documentElement, true));
                    } catch (e) {

                    }
                };

            return {
                // ls支持能力检测
                lsSupport: lsSupport,
                // 取出localstorage并投进dom
                // ls丢失率约为8%，封禁一天情况下uv占比8%，绝大部分都是android下ls2dom报错
                // 存储采用资源版本+资源内容的方式
                ls2dom: function(id, ver, resourceType) {
                    if (lserror) return;
                    //能够执行ls2dom说明检测过ls，不用再次判断
                    var data = window.localStorage.getItem(id),
                    conf = {
                        'js': 'script',
                        'css': 'style'
                    },
                    el, lsver, lsbody;


                    if (data && data.length > 100) {
                        lsver = data.slice(0, 1);
                        lsbody = data.slice(1);

                        if (lsver === ver) {
                            if (resourceType === 'symbol') {
                                renderSymbol(lsbody);
                            } else {

                                el = document.createElement(conf[resourceType]);

                                el.id = id;

                                el.innerHTML = lsbody;

                                document.head.appendChild(el);

                            }
                            return;
                        }
                    }

                    disableCache(function() {
                        window.location.reload();
                    });

                },
                // 页面render出的资源存入localstorage
                // 存储采用资源版本+资源内容的方式，资源版本1位字符
                res2ls: function (key, ver, resourceType) {
                    if (lserror) return;

                    if (lsSupport()) {
                        var el = getId(key),
                            data = el ? el.innerHTML : '';
                        try {
                            window.localStorage.setItem(key, ver + data);
                            if (resourceType === 'symbol') {
                                renderSymbol(data);
                            }
                        } catch (e) {
                            // console.log(key);
                            disableCache();
                        }
                    }
                    else {
                        disableCache();
                    }
                },

                res2dom: function(key, ver, resourceType) {
                    var el = getId(key),
                        data = el ? el.innerHTML : '';

                    if (resourceType === 'symbol') {
                        renderSymbol(data);
                    }
                }
            }
        })(),
        /**
         * @param {string} fnName;function name, same with folder name
         * @param {string} selector;sc position in results ;name + pos = [sc id]
         * @param {object} options;sc params
         * @param {boolean} hasHash;response for event HashResponse(hashchange)
         * @param {object} appMode;img: logo image src; extraId: define header extra className; appContext: app blueray display context object
         **/
        runsc = function(fnName, selector, options, hasHash, appMode) {
            var config = {
                name: fnName,
                id:selector,
                args: options,
                hasHash: hasHash
            };

            // 兼容app蓝光模式无fnName，不加入执行队列
            if(fnName) {
                //存sc执行池
                fnPool.push(config);
                //存hashchange响应池
                hasHash && hashPool.push(config);
            }

            // 处理强样式展示需求
            //appModeCount记录核区组里核区的个数若大于1个则以后都跳过
            if(appMode && !appModeCount++) {
                // 客户端蓝光逻辑，发送smss协议调用客户端蓝光
                if(appMode.appContext) {
                    var context = appMode.appContext,   //客户端上下文数据集合
                        product = context.product,      //产品名称
                        data = context.data,            //需要拼接到url后的数据
                        queryString = '',
                        ev = document.createEvent("Events"),    //用于触发schema的自定义事件
                        alink = document.createElement('a');    //用于触发schema的a标签

                    for(var item in data) {
                        queryString += '&' + item + '=' + data[item];
                    }

                    // 初始化自定义事件
                    ev.initEvent("click", false, true);

                    // 触发schema调起
                    alink.href = 'smss://' + (product ? '' : product + '.') + 'sm.cn/blueray/createnativediv?log_func=sm.log' + queryString;
                    alink.dispatchEvent(ev);
                }
                // 处理web蓝光
                else {
                    // appMode如果是非object类型，仅向content和header上添加class;在有多种样式展现情况下需要设置extraId
                    // appMode.extraId用以添加动态样式名,应对样式多变需求：.h_[sc name]_[extraId]
                    var defaultLogo = 'http://cdn.s.aliyun.com/L1/272/6837/static/wap/img/sm-strong-logo.png',
                        justEnableAppMode = (typeof(appMode) != 'object'),
                        elHeader = getId('header'),
                        elLogo,
                        headerClassName = 'h_' + fnName,
                        logoSrc = appMode.logo || defaultLogo,
                        extraId = justEnableAppMode ? '' : appMode.extraId;

                    if(elHeader) {
                        // 页面级别样式类
                        getId('content').className = 'p_c_strong p_' + fnName;
                        // header级别样式类
                        extraId && (headerClassName += ' ' + headerClassName + '_' + extraId);

                        elHeader.className = headerClassName;

                        elLogo = elHeader.querySelector('img');
                        logoSrc && elLogo && (elLogo.src = logoSrc);
                    }
                }
            }
        };


    //*****************sub namespace****************************************
    //html render namespace
    root.render = {};
    //sc controller set namespace
    root.sc = {};
    //helper function namespace
    root.helper = {};
    //sc function namespace
    root.fn = {};
    // sc hy namespace
    root.hy = {};
    // page static params
    root.PARAM = {}

    //*****************export function**************************************
    //[资源缓存专用]页面render出的资源存入localstorage
    root.res2ls = lsCore.res2ls;
    //[资源缓存专用]取出localstorage并投进dom
    root.ls2dom = lsCore.ls2dom;
    //[资源缓存专用]将类似svg资源存储
    root.res2dom = lsCore.res2dom;
    //localStorage是否支持
    root.lsSupport = lsCore.lsSupport;
    //设置cookie
    root.setCookie = setCookie;
    //读取cookie
    root.getCookie = getCookie;
    // 基础库后置依赖
    root.getFnPool = function() {
        return fnPool;
    };
    root.clearFnPool = function() {
        fnPool = [];
    };
    root.getHashPool = function() {
        return hashPool;
    };
    // handler
    root.handler = {};
    // sc统一调用接口
    root.runsc = runsc;
    // 自定义精灵统一调用接口
    root.runFairy = (function(){
        root.fairyPool = {};
        root.fairy = {};
        return function( fairyName, settings ){
            ( root.fairyPool[fairyName] = root.fairyPool[fairyName] || [] ).push( settings );
        };
    })();
    //export to window
    window.sm = root;

}(window, document);
