import {Molang, PositionChannel, RotationChannel, ScaleChannel, Vec3KeyframeValue} from "../types/AnimationSchema180";

/**
 * 动画处理通用工具函数
 */
export namespace APUtils {
  /**
   * 对 Channel 中出现的每一个长度为 3 的 Molang 数组执行处理
   */
  export function forEachVec3MolangOfChannel(data: PositionChannel | RotationChannel | ScaleChannel | undefined,
                                             callback: (molang: Molang[]) => void) {
    if (!data) return;

    const processVec3 = (vec3: Molang[]) => {
      if (vec3.length === 3) {
        callback(vec3);
      }
    };

    const processKeyframeValue = (value: Vec3KeyframeValue) => {
      if (Array.isArray(value)) {
        processVec3(value as Molang[]);
        return;
      }

      if (value.pre && Array.isArray(value.pre)) {
        processVec3(value.pre as Molang[]);
      }
      if (value.post && Array.isArray(value.post)) {
        processVec3(value.post as Molang[]);
      }
    };

    if (Array.isArray(data)) {
      processVec3(data as Molang[]);
      return;
    }

    if (typeof data === "object") {
      Object.values(data).forEach((value) => {
        if (Array.isArray(value)) {
          processVec3(value as Molang[]);
        } else if (value && typeof value === "object") {
          processKeyframeValue(value as Vec3KeyframeValue);
        }
      });
    }
  }

  /**
   * 对 Channel 中出现的每一个 Molang 语句执行处理
   * @param data
   * @param callback 处理函数，返回值将会赋给原 molang
   * @return data 本体是单个 Molang 时，返回修改后的 molang，其它情况返回原 data
   */
  export function forEachMolangOfChannel<T extends PositionChannel | RotationChannel | ScaleChannel | undefined>(data: T,
                                         callback: (molang: Molang) => Molang): T {
    if (data === undefined) return data;

    const processMolangArray = (arr: Molang[]) => {
      arr.forEach((value, index) => {
        if (typeof value === "string" || typeof value === "number") {
          arr[index] = callback(value);
        }
      });
    };

    const processRotationArray = (arr: any[]) => {
      arr.forEach((value, index) => {
        if (typeof value === "string" || typeof value === "number") {
          arr[index] = callback(value);
          return;
        }

        if (value && typeof value === "object") {
          (['x', 'y', 'z'] as const).forEach((axis) => {
            const axisValue = value[axis];
            if (typeof axisValue === "string" || typeof axisValue === "number") {
              value[axis] = callback(axisValue);
            }
          });
        }
      });
    };

    const processKeyframeValue = (value: Vec3KeyframeValue) => {
      if (Array.isArray(value)) {
        processMolangArray(value as Molang[]);
        return;
      }

      if (value.pre && Array.isArray(value.pre)) {
        processMolangArray(value.pre as Molang[]);
      }
      if (value.post && Array.isArray(value.post)) {
        processMolangArray(value.post as Molang[]);
      }
    };

    if (typeof data === "string" || typeof data === "number") {
      return callback(data) as T;
    }

    if (Array.isArray(data)) {
      processRotationArray(data as any[]);
      return data;
    }

    if (typeof data === "object") {
      Object.values(data).forEach((value) => {
        if (Array.isArray(value)) {
          processMolangArray(value as Molang[]);
        } else if (value && typeof value === "object") {
          processKeyframeValue(value as Vec3KeyframeValue);
        }
      });
    }

    return data;
  }
}
