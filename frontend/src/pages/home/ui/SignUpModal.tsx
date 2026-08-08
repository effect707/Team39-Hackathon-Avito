import { Modal } from "antd";
import { useNavigate } from "react-router";

interface SignUpModalProps {
    open: boolean;
}

export const SignUpModal = ({ open }: SignUpModalProps) => {
    const navigate = useNavigate();

    const handleClose = () => {
        navigate("/");
    };

    return (
        <Modal
            open={open}
            onCancel={handleClose}
            footer={null}
        >
            <h2>Регистрация</h2>

            {/* форма */}
        </Modal>
    );
};