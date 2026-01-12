import { bizInfo } from '@/mock/business';
import { ACTION_LABELS } from '@/pages/Analysis/constants';
import { OperationDetail } from '@/pages/Analysis/Types';

/***
 * Process the detail list from server response
 * @param detailList - The detail list to process
 * @returns The processed operation detail list
 */
export const processDetailList = (detailList: any[]): OperationDetail[] => {
  return detailList.map((detailItem, index) => {
    const {
      bk_biz_id,
      resource_type,
      operation_detail,
      user,
      operation_time,
      resource_name,
      action,
    } = detailItem;

    const actionName = ACTION_LABELS[action] || action;

    return {
      id: index + 1,
      business: bizInfo.info.find((biz) => biz.bk_biz_id === bk_biz_id)?.bk_biz_name || '--',
      object: resource_type,
      action: actionName,
      modelType: operation_detail.bk_obj_id,
      instance: resource_name,
      description: `${actionName}${resource_name}`,
      time: operation_time,
      account: user,
      details: {
        preData: operation_detail.details.pre_data,
        curData: operation_detail.details.cur_data,
        updateFields: operation_detail.details.update_fields,
      },
    };
  });
};
