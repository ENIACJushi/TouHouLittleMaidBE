import { testCommandRegister } from "../TestCommandRegister";
import { GeneralBullet } from '../../src/danmaku/shapes/bullets/general_bullet/GeneralBullet';
import { Entity, world } from "@minecraft/server";
import { LineShoot } from '../../src/danmaku/shoots/LineShoot'
import { EntityDanmakuActor } from "../../src/danmaku/actors/EntityDanmakuActor";
import { Vector } from "../../src/libs/VectorMC";
import { Logger } from "../../src/controller/Logger";

const TAG = 'BulletTest';

export class BulletTest {
  constructor () {
    testCommandRegister.register('b1', (source: Entity) => {
      Logger.info(TAG, 'test: bullet');
      new LineShoot({
        shape: new GeneralBullet().setRandomColor().setRandomType().setDamage(1).setLifeTime(20),
        thrower: new EntityDanmakuActor(source, true),
        preJudge: true,
      }).shootByDirection(source.getViewDirection(), 2.8);
    });
    testCommandRegister.register('b2', (source: Entity) => {
      Logger.info(TAG, 'test: bullet');
      new LineShoot({
        shape: new GeneralBullet().setRandomColor().setRandomType().setDamage(1).setLifeTime(20),
        thrower: new EntityDanmakuActor(source, true),
        preJudge: true,
      }).shootByVelocity(source.getViewDirection(), 2.8);
    });
  }
}
