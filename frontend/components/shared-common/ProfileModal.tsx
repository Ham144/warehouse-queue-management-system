import React from "react";
import { useUserInfo } from "../UserContext";

const ProfileModal = () => {
  const { userInfo } = useUserInfo();

  return (
    <dialog id="profile_modal" className="modal">
      <div className="modal-box bg-teal-50 border border-teal-100">
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 bg-teal-100 rounded-full flex items-center justify-center mb-4 border-4 border-teal-200">
            <span className="text-3xl font-bold text-teal-700">
              {userInfo?.username?.charAt(0)}
            </span>
          </div>
          <h3 className="text-2xl font-bold text-teal-800">
            {userInfo?.username}
          </h3>
          <div className="badge badge-lg bg-teal-100 text-teal-700 border-teal-300 mt-2 px-3 py-2">
            {userInfo?.role?.replace("_", " ")}
          </div>
        </div>

        <div className="space-y-4">
          {/* User Info Section */}
          <div className="bg-white p-4 rounded-lg border border-teal-100">
            <h4 className="font-semibold text-teal-700 mb-2 text-lg">
              User Information
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Organization</span>
                <span className="font-medium text-teal-800">
                  {userInfo?.organizationName}
                </span>
              </div>
              {userInfo?.vendorName && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Vendor</span>
                  <span className="font-medium text-teal-800">
                    {userInfo.vendorName}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Warehouse Info Section */}
          {userInfo?.homeWarehouse && (
            <div className="bg-white p-4 rounded-lg border border-teal-100">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-teal-700 text-lg">
                  Home Warehouse
                </h4>
                <div
                  className={`badge ${userInfo?.homeWarehouse?.isActive ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}`}
                >
                  {userInfo?.homeWarehouse?.isActive ? "Active" : "Inactive"}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Warehouse Name</p>
                  <p className="font-medium text-teal-800">
                    {userInfo?.homeWarehouse?.name}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium text-teal-800">
                    {userInfo?.homeWarehouse?.location}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Description</p>
                  <p className="font-medium text-teal-800 text-sm">
                    {userInfo?.homeWarehouse?.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-teal-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500">Min Queue Interval</p>
                    <p className="font-bold text-teal-700">
                      {userInfo?.homeWarehouse?.intervalMinimalQueueu} min
                    </p>
                  </div>
                  <div className="bg-teal-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500">Delay Tolerance</p>
                    <p className="font-bold text-teal-700">
                      {userInfo?.homeWarehouse?.delayTolerance} min
                    </p>
                  </div>
                  <div className="bg-teal-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500">Max Week Selection</p>
                    <p className="font-bold text-teal-700">
                      {userInfo?.homeWarehouse?.maximumWeekSelection} weeks
                    </p>
                  </div>
                  <div className="bg-teal-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-500">Auto Efficient</p>
                    <p
                      className={`font-bold ${userInfo?.homeWarehouse?.isAutoEfficientActive ? "text-green-600" : "text-red-600"}`}
                    >
                      {userInfo?.homeWarehouse?.isAutoEfficientActive
                        ? "Active"
                        : "Inactive"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-action mt-8">
          <form method="dialog">
            <button className="btn bg-teal-600 hover:bg-teal-700 text-white border-teal-600">
              Close
            </button>
          </form>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
};

export default ProfileModal;
