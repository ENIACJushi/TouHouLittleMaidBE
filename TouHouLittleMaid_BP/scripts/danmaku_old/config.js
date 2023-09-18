//////// Config ////////
export const DanmakuTypes = Object.freeze({
    PELLET  : {name: 'pellet'  },
    BALL    : {name: 'ball'    },
    ORBS    : {name: 'orbs'    },
    BIG_BALL: {name: 'big_ball'}
});
export const DanmakuColors = Object.freeze({
    RANDOM  : -1,
    RED     : 1,
    ORANGE  : 2,
    YELLOW  : 3,
    LIME    : 4,
    LIGHT_GREEN : 5,
    GREEN   : 6,
    CYAN    : 7,
    LIGHT_BLUE : 8,
    BLUE    : 8,
    PURPLE  : 9,
    MAGENTA : 11,
    PINK    : 12,
    GRAY    : 13

});
export const GoheiSequence = Object.freeze([
    DanmakuTypes.PELLET,
    DanmakuTypes.BALL,
    DanmakuTypes.ORBS,
    DanmakuTypes.BIG_BALL
]);
export const DefaultDanmaku = DanmakuTypes.PELLET;
export const GoheiPrefix    = "touhou_little_maid:hakurei_gohei_";
export const DanmakuPrefix  = "thlmd:danmaku_basic_";
