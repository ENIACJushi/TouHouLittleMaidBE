/* -------------------------------------------- *\
 *  Name        :  Second Watch                 *
 *  Description :  Lazy                         *
 *  Author      :  ENIACJushi                   *
 *  Version     :  1.0                          *
 *  Date        :  2024.04.02                   *
\* -------------------------------------------- */
export class Watch {
    start() {
        this.time = new Date().getMilliseconds();
    }
    /**
     * 距离开始过去的毫秒数
     * @returns {number}
     */
    stop() {
        return new Date().getMilliseconds() - this.time;
    }
}
//# sourceMappingURL=SecondWatch.js.map