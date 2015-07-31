var exports = function(io) {

    var express = require("express");
    var request = require("request");
    var cheerio = require("cheerio");
    var Game = require("../models/gameSchema");
    var router = express.Router();
    var util = require("../util");

    router.get("/update_games_list", function(req, res) {
        io.sockets.emit("new day");
        var today = new Date();
        var day = today.getDate();
        var month = today.getMonth()+1;
        var year = today.getFullYear();
        if(day<10) day="0"+day
        if(month<10) month="0"+month 
        var url = "http://gd2.mlb.com/components/game/mlb/";
        var date_string = "year_"+year+"/month_"+month+"/day_"+day+"/";
        var url = url + date_string;
        request(url, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                $ = cheerio.load(body);
                var items = $("ul").find("li");
                items.each(function(i,item) {
                    var href = item.children[0].attribs.href;
                    if(href.substring(0,3) == "gid") {
                        Game.findOne({"game_id": href}, "game_id", function(err, game) {
                            if (err) console.log("ERROR"); //fix this
                            if (!game) {
                                Game.create({game_id: href, date_string : date_string}, function(err) {
                                    if(err) console.log("ERROR"); //fix this
                                    var data = {
                                        link : href,
                                        title : util.create_link_text(href)
                                    };
                                    io.sockets.emit("new game",data);
                                });
                            }
                        });
                    }
                });
            }
        });
        res.status(200).send();
    });

    router.get("/update_games", function(req, res) {
        Game.find({active:true},function(err, games) {
            games.forEach(function(game) {
                var url = "http://gd2.mlb.com/components/game/mlb/" + game.date_string + game.game_id + "game_events.json";
                // var url = "http://gd2.mlb.com/components/game/mlb/year_2015/month_07/day_24/gid_2015_07_24_oakmlb_sfnmlb_1/game_events.json"; //for test purposes only
                request(url, function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        var innings = JSON.parse(body).data.game.inning;
                        innings.forEach(function(inning) {
                            if (typeof inning.top.atbat != 'undefined') {
                                inning.top.atbat.forEach(function(action,index) {
                                    make_event(inning.num,action,game);
                                });
                            }
                            if (typeof inning.top.action != 'undefined') {
                                if(Array.isArray(inning.top.action)) {
                                    inning.top.action.forEach(function(action,index) {
                                        make_event(inning.num,action,game);
                                    });
                                } else {
                                    make_event(inning.num,inning.top.action,game);
                                }
                            }
                            if (typeof inning.bottom.atbat != 'undefined') {
                                inning.bottom.atbat.forEach(function(action,index) {
                                    make_event(inning.num,action,game);
                                });
                            }
                            if (typeof inning.bottom.action != 'undefined') {
                                if(Array.isArray(inning.bottom.action)) {
                                    inning.bottom.action.forEach(function(action,index) {
                                        make_event(inning.num,action,game);
                                    });
                                } else {
                                    make_event(inning.num,inning.bottom.action,game);
                                }
                            }
                        });                        
                    }
                });
            });
        });
        res.status(200).send();
    });

    router.post("/submit_guess", function(req,res) {
        if(req.user) {
            console.log("asdf");
        }
        res.status(200).send();
    });

    function make_event(inning,action,game) {
        var event_id = game.game_id.slice(0, -1) + "_" + action.event_num;
        Game.Event.findOne({ event_id : event_id }, function(err,event) {
            if(event == null) {
                Game.Event.create({
                        event_id : event_id,
                        game : game,
                        inning : inning,
                        event_type : action.event
                    },
                    function(err, event) {
                        io.sockets.emit("new event", {event : event});
                    }
                );
            }
        });
        
    }

    return router;
}

module.exports = exports;
